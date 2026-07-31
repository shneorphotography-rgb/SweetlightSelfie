"""Select a couple-aware default cover for each gallery.

This is a development/import-time tool. It detects faces with YuNet, extracts
local SFace embeddings, clusters identities within each gallery, and selects a
wide image containing the dominant recurring pair. Embeddings can be kept in
an optional local cache, but are never written to the result JSON.

Manifest shape:
{
  "galleries": [
    {
      "id": 1,
      "images": [
        {
          "path": "C:/absolute/or/manifest-relative/image.webp",
          "source": "/public/source.webp",
          "width": 2200,
          "height": 1467
        }
      ]
    }
  ]
}
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import shutil
import sys
import tempfile
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import cv2
import numpy as np


ALGORITHM_VERSION = "couple-cover-v1.1.0"
# Keep detection/embedding cache compatibility for scoring-only changes.
DETECTION_CACHE_VERSION = "couple-cover-v1.0.0"
OUTPUT_VERSION = 2
MAX_FACES_PER_IMAGE = 24
SEED_CLUSTER_COSINE_THRESHOLD = 0.52
ATTACH_CLUSTER_COSINE_THRESHOLD = 0.46
HIGH_QUALITY_SAMPLE_THRESHOLD = 0.58
SOFT_VERIFY_COSINE_THRESHOLD = 0.36
SOFT_VERIFY_CROWD_MINIMUM = 0.42
SOFT_VERIFY_CROWD_AVERAGE = 0.48
SOFT_PAIR_SCORE_PENALTY = 1.5
MIN_EMBEDDING_FACE_SIZE = 28
DEFAULT_TARGET_ASPECTS = [2.2, 0.8, 1.5]
FACE_SAFE_PADDING_X = 0.65
FACE_SAFE_PADDING_TOP = 0.8
FACE_SAFE_PADDING_BOTTOM = 0.7


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, float(value)))


def round_number(value: float, digits: int = 3) -> float:
    return round(float(value), digits)


def normalize(vector: np.ndarray) -> np.ndarray | None:
    flattened = np.asarray(vector, dtype=np.float32).reshape(-1)
    length = float(np.linalg.norm(flattened))
    if not math.isfinite(length) or length <= 1e-8:
        return None
    return flattened / length


def read_json(path_value: str) -> tuple[dict[str, Any], Path]:
    if path_value == "-":
        return json.load(sys.stdin), Path.cwd()
    manifest_path = Path(path_value).expanduser().resolve()
    with manifest_path.open("r", encoding="utf-8-sig") as file:
        return json.load(file), manifest_path.parent


def write_json(path_value: str, payload: dict[str, Any]) -> None:
    output_path = Path(path_value).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_name(f".{output_path.name}.tmp")
    with temporary_path.open("w", encoding="utf-8", newline="\n") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")
    os.replace(temporary_path, output_path)


def resolve_image_path(path_value: str, manifest_directory: Path) -> Path:
    candidate = Path(path_value).expanduser()
    if candidate.is_absolute():
        return candidate.resolve()
    manifest_relative = (manifest_directory / candidate).resolve()
    if manifest_relative.exists():
        return manifest_relative
    return (Path.cwd() / candidate).resolve()


def read_image(image_path: Path) -> np.ndarray | None:
    """Decode Unicode paths reliably on Windows."""
    try:
        encoded = np.fromfile(str(image_path), dtype=np.uint8)
    except OSError:
        return None
    if encoded.size == 0:
        return None
    return cv2.imdecode(encoded, cv2.IMREAD_COLOR)


def ascii_compatible_model_path(model_path: Path) -> Path:
    """OpenCV DNN on Windows cannot always load models through Unicode paths."""
    model_path = model_path.expanduser().resolve()
    if not model_path.is_file():
        raise FileNotFoundError(f"Model not found: {model_path}")

    try:
        str(model_path).encode("ascii")
        return model_path
    except UnicodeEncodeError:
        cache_directory = Path(tempfile.gettempdir()) / "portfolio-face-models"
        cache_directory.mkdir(parents=True, exist_ok=True)
        compatible_path = cache_directory / model_path.name
        source_stat = model_path.stat()
        needs_copy = not compatible_path.exists()
        if not needs_copy:
            target_stat = compatible_path.stat()
            needs_copy = (
                target_stat.st_size != source_stat.st_size
                or target_stat.st_mtime_ns < source_stat.st_mtime_ns
            )
        if needs_copy:
            shutil.copy2(model_path, compatible_path)
        return compatible_path


def model_signature(model_path: Path) -> str:
    stat = model_path.stat()
    return f"{model_path.name}:{stat.st_size}:{stat.st_mtime_ns}"


class AnalysisCache:
    def __init__(self, cache_path: str | None, algorithm_signature: str):
        self.path = Path(cache_path).expanduser().resolve() if cache_path else None
        self.algorithm_signature = algorithm_signature
        self.entries: dict[str, Any] = {}
        self.hits = 0
        self.misses = 0
        self.dirty = False
        if self.path and self.path.is_file():
            try:
                with self.path.open("r", encoding="utf-8-sig") as file:
                    payload = json.load(file)
                if payload.get("algorithm") == algorithm_signature:
                    entries = payload.get("entries")
                    if isinstance(entries, dict):
                        self.entries = entries
            except (OSError, ValueError, TypeError):
                self.entries = {}

    def key_for(self, image_path: Path) -> str:
        stat = image_path.stat()
        identity = {
            "path": os.path.normcase(str(image_path.resolve())),
            "mtimeNs": stat.st_mtime_ns,
            "size": stat.st_size,
            "algorithm": self.algorithm_signature,
        }
        encoded = json.dumps(
            identity,
            sort_keys=True,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def get(self, image_path: Path) -> dict[str, Any] | None:
        if not self.path:
            return None
        try:
            key = self.key_for(image_path)
        except OSError:
            return None
        value = self.entries.get(key)
        if isinstance(value, dict):
            self.hits += 1
            return value
        self.misses += 1
        return None

    def put(self, image_path: Path, value: dict[str, Any]) -> None:
        if not self.path:
            return
        try:
            key = self.key_for(image_path)
        except OSError:
            return
        self.entries[key] = value
        self.dirty = True

    def save(self) -> None:
        if not self.path or not self.dirty:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = self.path.with_name(f".{self.path.name}.tmp")
        payload = {
            "algorithm": self.algorithm_signature,
            "notice": (
                "Local build-time biometric cache. Do not publish or send "
                "this file to the browser."
            ),
            "entries": self.entries,
        }
        with temporary_path.open("w", encoding="utf-8", newline="\n") as file:
            json.dump(payload, file, ensure_ascii=False, separators=(",", ":"))
        os.replace(temporary_path, self.path)


class FaceAnalyzer:
    def __init__(
        self,
        detector_model: Path,
        recognizer_model: Path,
        cache: AnalysisCache,
        max_dimension: int,
        detector_threshold: float,
    ):
        detector_path = ascii_compatible_model_path(detector_model)
        recognizer_path = ascii_compatible_model_path(recognizer_model)
        self.detector = cv2.FaceDetectorYN.create(
            str(detector_path),
            "",
            (320, 320),
            detector_threshold,
            0.3,
            5000,
        )
        self.recognizer = cv2.FaceRecognizerSF.create(str(recognizer_path), "")
        self.cache = cache
        self.max_dimension = max(320, int(max_dimension))

    def analyze(self, image_path: Path) -> dict[str, Any]:
        cached = self.cache.get(image_path)
        if cached is not None:
            return cached

        image = read_image(image_path)
        if image is None:
            result = {"error": "Image could not be decoded", "faces": []}
            self.cache.put(image_path, result)
            return result

        source_height, source_width = image.shape[:2]
        scale = min(
            1.0,
            self.max_dimension / max(source_width, source_height),
        )
        if scale < 1:
            working_width = max(1, round(source_width * scale))
            working_height = max(1, round(source_height * scale))
            working_image = cv2.resize(
                image,
                (working_width, working_height),
                interpolation=cv2.INTER_AREA,
            )
        else:
            working_image = image
            working_height, working_width = working_image.shape[:2]

        gray = cv2.cvtColor(working_image, cv2.COLOR_BGR2GRAY)
        sharpness_raw = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        sharpness = clamp((math.log10(max(1.0, sharpness_raw)) - 1.25) / 1.8)
        mean_luma = float(np.mean(gray)) / 255.0
        dark_clipping = float(np.mean(gray <= 8))
        light_clipping = float(np.mean(gray >= 247))
        exposure_center = clamp(1.0 - abs(mean_luma - 0.52) / 0.46)
        clipping_score = clamp(1.0 - (dark_clipping + light_clipping) * 3.2)
        exposure = exposure_center * 0.7 + clipping_score * 0.3

        self.detector.setInputSize((working_width, working_height))
        _, detected = self.detector.detect(working_image)
        detected_rows: list[np.ndarray] = []
        if detected is not None:
            detected_rows = sorted(
                (np.asarray(row, dtype=np.float32) for row in detected),
                key=lambda row: float(row[2] * row[3] * row[-1]),
                reverse=True,
            )[:MAX_FACES_PER_IMAGE]

        faces: list[dict[str, Any]] = []
        for row in detected_rows:
            x, y, width, height = (float(value) for value in row[:4])
            confidence = float(row[-1])
            full_x = max(0.0, x / scale)
            full_y = max(0.0, y / scale)
            full_width = min(float(source_width) - full_x, width / scale)
            full_height = min(float(source_height) - full_y, height / scale)
            face_size_score = clamp(min(width, height) / 130.0)
            embedding_quality = clamp(
                confidence * (0.25 + face_size_score * 0.75)
            )
            feature: list[float] | None = None
            if min(width, height) >= MIN_EMBEDDING_FACE_SIZE:
                try:
                    aligned = self.recognizer.alignCrop(
                        working_image,
                        row[:-1],
                    )
                    normalized = normalize(self.recognizer.feature(aligned))
                    if normalized is not None:
                        feature = normalized.astype(float).tolist()
                except cv2.error:
                    feature = None

            faces.append(
                {
                    "x": full_x,
                    "y": full_y,
                    "width": max(0.0, full_width),
                    "height": max(0.0, full_height),
                    "confidence": confidence,
                    "quality": embedding_quality,
                    "embedding": feature,
                }
            )

        result = {
            "width": int(source_width),
            "height": int(source_height),
            "sharpness": sharpness,
            "exposure": exposure,
            "faces": faces,
        }
        self.cache.put(image_path, result)
        return result


def cluster_identities(images: list[dict[str, Any]]) -> list[dict[str, Any]]:
    samples: list[dict[str, Any]] = []
    for image_index, image in enumerate(images):
        for face_index, face in enumerate(image["analysis"].get("faces", [])):
            raw_embedding = face.get("embedding")
            if raw_embedding is None:
                continue
            embedding = normalize(np.asarray(raw_embedding, dtype=np.float32))
            if embedding is None:
                continue
            samples.append(
                {
                    "imageIndex": image_index,
                    "faceIndex": face_index,
                    "quality": float(face.get("quality", 0)),
                    "embedding": embedding,
                }
            )

    samples.sort(key=lambda sample: sample["quality"], reverse=True)
    seed_samples = [
        sample
        for sample in samples
        if sample["quality"] >= HIGH_QUALITY_SAMPLE_THRESHOLD
    ]
    attachment_samples = [
        sample
        for sample in samples
        if sample["quality"] < HIGH_QUALITY_SAMPLE_THRESHOLD
    ]
    clusters: list[dict[str, Any]] = []

    def add_sample(sample: dict[str, Any], threshold: float) -> None:
        best_cluster: dict[str, Any] | None = None
        best_similarity = -1.0
        for cluster in clusters:
            if sample["imageIndex"] in cluster["imageIndices"]:
                continue
            # Compare with a robust cluster representative and its best
            # high-quality members. This is more tolerant for oblique faces
            # without allowing transitive guest-to-guest merges.
            representative_similarities = [
                float(np.dot(sample["embedding"], cluster["centroid"]))
            ]
            representative_similarities.extend(
                float(np.dot(sample["embedding"], member["embedding"]))
                for member in sorted(
                    cluster["members"],
                    key=lambda member: member["quality"],
                    reverse=True,
                )[:3]
            )
            similarity = max(representative_similarities)
            if similarity >= threshold and similarity > best_similarity:
                best_cluster = cluster
                best_similarity = similarity

        if best_cluster is None:
            clusters.append(
                {
                    "members": [sample],
                    "imageIndices": {sample["imageIndex"]},
                    "centroid": sample["embedding"].copy(),
                }
            )
            return

        best_cluster["members"].append(sample)
        best_cluster["imageIndices"].add(sample["imageIndex"])
        weighted = np.zeros_like(best_cluster["centroid"])
        weight_total = 0.0
        for member in best_cluster["members"]:
            weight = 0.35 + member["quality"] * 0.65
            weighted += member["embedding"] * weight
            weight_total += weight
        centroid = normalize(weighted / max(weight_total, 1e-8))
        if centroid is not None:
            best_cluster["centroid"] = centroid

    # Strict high-quality seeding prevents different wedding guests from being
    # joined early. Lower-quality/profile samples may then attach to an
    # established identity at a slightly more tolerant threshold.
    for sample in seed_samples:
        add_sample(sample, SEED_CLUSTER_COSINE_THRESHOLD)
    for sample in attachment_samples:
        add_sample(sample, ATTACH_CLUSTER_COSINE_THRESHOLD)

    clusters.sort(
        key=lambda cluster: (
            len(cluster["imageIndices"]),
            len(cluster["members"]),
            sum(member["quality"] for member in cluster["members"]),
        ),
        reverse=True,
    )

    for cluster_id, cluster in enumerate(clusters):
        cluster["id"] = cluster_id
        for member in cluster["members"]:
            face = images[member["imageIndex"]]["analysis"]["faces"][
                member["faceIndex"]
            ]
            face["clusterId"] = cluster_id
    return clusters


def faces_by_cluster(image: dict[str, Any]) -> dict[int, dict[str, Any]]:
    selected: dict[int, dict[str, Any]] = {}
    for face in image["analysis"].get("faces", []):
        cluster_id = face.get("clusterId")
        if cluster_id is None:
            continue
        previous = selected.get(cluster_id)
        if previous is None or face.get("quality", 0) > previous.get("quality", 0):
            selected[cluster_id] = face
    return selected


def find_dominant_pair(
    images: list[dict[str, Any]],
    clusters: list[dict[str, Any]],
) -> tuple[tuple[int, int] | None, int]:
    if not clusters:
        return None, 0
    minimum_recurrence = max(2, min(4, math.ceil(len(images) * 0.035)))
    recurring_ids = {
        cluster["id"]
        for cluster in clusters
        if len(cluster["imageIndices"]) >= minimum_recurrence
    }
    pair_data: dict[tuple[int, int], dict[str, float]] = defaultdict(
        lambda: {"appearances": 0.0, "quality": 0.0, "prominence": 0.0}
    )

    for image in images:
        clustered_faces = faces_by_cluster(image)
        ids = sorted(cluster_id for cluster_id in clustered_faces if cluster_id in recurring_ids)
        image_area = max(
            1.0,
            float(image["analysis"].get("width", 1))
            * float(image["analysis"].get("height", 1)),
        )
        for first_index in range(len(ids)):
            for second_index in range(first_index + 1, len(ids)):
                pair = (ids[first_index], ids[second_index])
                first_face = clustered_faces[pair[0]]
                second_face = clustered_faces[pair[1]]
                pair_data[pair]["appearances"] += 1
                pair_data[pair]["quality"] += (
                    float(first_face.get("quality", 0))
                    + float(second_face.get("quality", 0))
                ) / 2
                pair_area = (
                    first_face["width"] * first_face["height"]
                    + second_face["width"] * second_face["height"]
                )
                pair_data[pair]["prominence"] += math.sqrt(pair_area / image_area)

    eligible_pairs = [
        (pair, data)
        for pair, data in pair_data.items()
        if data["appearances"] >= 2
    ]
    if not eligible_pairs:
        return None, 0

    cluster_by_id = {cluster["id"]: cluster for cluster in clusters}

    def pair_rank(item: tuple[tuple[int, int], dict[str, float]]) -> float:
        pair, data = item
        appearances = data["appearances"]
        individual_recurrence = min(
            len(cluster_by_id[pair[0]]["imageIndices"]),
            len(cluster_by_id[pair[1]]["imageIndices"]),
        )
        average_quality = data["quality"] / appearances
        average_prominence = data["prominence"] / appearances
        return (
            appearances * 10
            + individual_recurrence * 1.4
            + average_quality * 2.5
            + average_prominence * 2
        )

    best_pair, best_data = max(eligible_pairs, key=pair_rank)
    return best_pair, int(best_data["appearances"])


def landscape_score(width: float, height: float) -> float:
    ratio = width / max(height, 1.0)
    if ratio >= 1.45:
        return 1.0
    if ratio >= 1.0:
        return 0.58 + (ratio - 1.0) / 0.45 * 0.42
    return clamp((ratio - 0.58) / 0.42) * 0.58


def significant_faces(image: dict[str, Any]) -> list[dict[str, Any]]:
    faces = image["analysis"].get("faces", [])
    if not faces:
        return []
    largest_area = max(face["width"] * face["height"] for face in faces)
    return [
        face
        for face in faces
        if face.get("confidence", 0) >= 0.62
        and face["width"] * face["height"] >= largest_area * 0.1
    ]


def soft_verify_dominant_pair(
    image: dict[str, Any],
    dominant_pair: tuple[int, int],
    clusters: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, float]] | None:
    """Verify a known pair directly without weakening identity clustering.

    Strict clustering intentionally rejects borderline/profile samples. Once a
    stable recurring pair is known, SFace's verification threshold can safely
    recover those faces for cover candidacy. Distinct identities must match
    distinct faces, and crowd images require substantially stronger scores.
    """
    cluster_by_id = {cluster["id"]: cluster for cluster in clusters}
    first_cluster = cluster_by_id.get(dominant_pair[0])
    second_cluster = cluster_by_id.get(dominant_pair[1])
    if not first_cluster or not second_cluster:
        return None

    visible_faces = significant_faces(image)
    candidates: list[tuple[dict[str, Any], np.ndarray]] = []
    for face in visible_faces:
        raw_embedding = face.get("embedding")
        if raw_embedding is None:
            continue
        embedding = normalize(np.asarray(raw_embedding, dtype=np.float32))
        if embedding is not None:
            candidates.append((face, embedding))
    if len(candidates) < 2:
        return None

    first_centroid = first_cluster["centroid"]
    second_centroid = second_cluster["centroid"]
    best_assignment: tuple[
        float,
        float,
        dict[str, Any],
        dict[str, Any],
    ] | None = None
    best_rank = -1.0

    for first_index, (first_face, first_embedding) in enumerate(candidates):
        first_similarity = float(np.dot(first_embedding, first_centroid))
        for second_index, (second_face, second_embedding) in enumerate(candidates):
            if first_index == second_index:
                continue
            second_similarity = float(np.dot(second_embedding, second_centroid))
            minimum_similarity = min(first_similarity, second_similarity)
            average_similarity = (first_similarity + second_similarity) / 2
            # Prefer balanced assignments so one excellent match cannot hide
            # an unrelated second person.
            rank = minimum_similarity * 0.68 + average_similarity * 0.32
            if rank > best_rank:
                best_rank = rank
                best_assignment = (
                    first_similarity,
                    second_similarity,
                    first_face,
                    second_face,
                )

    if best_assignment is None:
        return None
    first_similarity, second_similarity, first_face, second_face = best_assignment
    minimum_similarity = min(first_similarity, second_similarity)
    average_similarity = (first_similarity + second_similarity) / 2
    exact_two = len(visible_faces) == 2
    accepted = (
        minimum_similarity >= SOFT_VERIFY_COSINE_THRESHOLD
        and (
            exact_two
            or (
                minimum_similarity >= SOFT_VERIFY_CROWD_MINIMUM
                and average_similarity >= SOFT_VERIFY_CROWD_AVERAGE
            )
        )
    )
    if not accepted:
        return None

    return [first_face, second_face], {
        "pairMatchMode": "soft-sface-verification",
        "pairSimilarityFirst": first_similarity,
        "pairSimilaritySecond": second_similarity,
        "pairSimilarityMin": minimum_similarity,
        "pairSimilarityAverage": average_similarity,
    }


def crop_metrics(
    image: dict[str, Any],
    focus_faces: list[dict[str, Any]],
    target_aspects: list[float],
) -> tuple[float, dict[str, Any]]:
    width = float(image["analysis"].get("width", 1))
    height = float(image["analysis"].get("height", 1))
    if not focus_faces:
        return 0.5, {
            "x": 50.0,
            "y": 50.0,
            "safeArea": {"left": 0.0, "top": 0.0, "right": 100.0, "bottom": 100.0},
        }

    left = min(face["x"] for face in focus_faces)
    top = min(face["y"] for face in focus_faces)
    right = max(face["x"] + face["width"] for face in focus_faces)
    bottom = max(face["y"] + face["height"] for face in focus_faces)
    largest_width = max(face["width"] for face in focus_faces)
    largest_height = max(face["height"] for face in focus_faces)
    desired_left = left - largest_width * FACE_SAFE_PADDING_X
    desired_top = top - largest_height * FACE_SAFE_PADDING_TOP
    desired_right = right + largest_width * FACE_SAFE_PADDING_X
    desired_bottom = bottom + largest_height * FACE_SAFE_PADDING_BOTTOM
    safe_left = max(0.0, desired_left)
    safe_top = max(0.0, desired_top)
    safe_right = min(width, desired_right)
    safe_bottom = min(height, desired_bottom)
    safe_width = max(1.0, safe_right - safe_left)
    safe_height = max(1.0, safe_bottom - safe_top)

    requested_padding = max(
        1.0,
        (desired_right - desired_left) * (desired_bottom - desired_top),
    )
    retained_padding = clamp((safe_width * safe_height) / requested_padding)
    source_aspect = width / max(height, 1.0)
    aspect_scores = []
    for target_aspect in target_aspects or DEFAULT_TARGET_ASPECTS:
        target_aspect = max(0.2, float(target_aspect))
        if source_aspect >= target_aspect:
            crop_height = height
            crop_width = height * target_aspect
        else:
            crop_width = width
            crop_height = width / target_aspect
        aspect_scores.append(
            min(1.0, crop_width / safe_width, crop_height / safe_height)
        )
    average_fit = sum(aspect_scores) / len(aspect_scores)
    worst_fit = min(aspect_scores)
    safe_crop_score = clamp(
        average_fit * 0.52 + worst_fit * 0.3 + retained_padding * 0.18
    )

    focus_x = clamp(((left + right) / 2) / width) * 100
    focus_y = clamp(((top + bottom) / 2) / height) * 100
    return safe_crop_score, {
        "x": round_number(focus_x),
        "y": round_number(focus_y),
        "safeArea": {
            "left": round_number(safe_left / width * 100),
            "top": round_number(safe_top / height * 100),
            "right": round_number(safe_right / width * 100),
            "bottom": round_number(safe_bottom / height * 100),
        },
    }


def image_quality_metrics(
    image: dict[str, Any],
    focus_faces: list[dict[str, Any]],
    target_aspects: list[float],
) -> dict[str, float]:
    analysis = image["analysis"]
    width = float(analysis.get("width", 1))
    height = float(analysis.get("height", 1))
    image_area = max(1.0, width * height)
    face_quality = (
        sum(float(face.get("quality", 0)) for face in focus_faces)
        / len(focus_faces)
        if focus_faces
        else 0.0
    )
    pair_area = sum(face["width"] * face["height"] for face in focus_faces)
    face_prominence = clamp(math.sqrt(pair_area / image_area) / 0.16)
    crop_score, focus = crop_metrics(image, focus_faces, target_aspects)
    return {
        "landscape": landscape_score(width, height),
        "safeCrop": crop_score,
        "faceQuality": face_quality,
        "faceProminence": face_prominence,
        "sharpness": float(analysis.get("sharpness", 0)),
        "exposure": float(analysis.get("exposure", 0)),
        "focus": focus,
    }


def score_pair_candidate(
    image: dict[str, Any],
    pair_faces: list[dict[str, Any]],
    target_aspects: list[float],
) -> tuple[float, dict[str, Any]]:
    metrics = image_quality_metrics(image, pair_faces, target_aspects)
    visible_faces = significant_faces(image)
    extra_faces = max(0, len(visible_faces) - 2)
    exact_pair = 1.0 if len(visible_faces) == 2 else 0.0
    score = (
        25
        + metrics["landscape"] * 18
        + metrics["safeCrop"] * 24
        + metrics["faceQuality"] * 11
        + exact_pair * 11
        + metrics["faceProminence"] * 5
        + metrics["sharpness"] * 3
        + metrics["exposure"] * 3
        - min(10, extra_faces * 2)
    )
    return clamp(score, 0, 100), {
        **metrics,
        "exactPair": bool(exact_pair),
        "significantFaceCount": len(visible_faces),
        "extraFaces": extra_faces,
    }


def score_fallback_candidate(
    image: dict[str, Any],
    faces: list[dict[str, Any]],
    exactly_two: bool,
    target_aspects: list[float],
) -> tuple[float, dict[str, Any]]:
    metrics = image_quality_metrics(image, faces, target_aspects)
    score = (
        12
        + metrics["landscape"] * 30
        + metrics["safeCrop"] * 20
        + metrics["faceQuality"] * 12
        + metrics["faceProminence"] * 6
        + metrics["sharpness"] * 6
        + metrics["exposure"] * 6
        + (8 if exactly_two else 0)
    )
    return clamp(score, 0, 100), {
        **metrics,
        "exactPair": exactly_two,
        "significantFaceCount": len(significant_faces(image)),
        "extraFaces": max(0, len(significant_faces(image)) - 2),
    }


def public_selected_metrics(
    image: dict[str, Any],
    metrics: dict[str, Any],
) -> dict[str, Any]:
    analysis = image["analysis"]
    public_metrics = {
        "width": int(analysis.get("width", image.get("width") or 0)),
        "height": int(analysis.get("height", image.get("height") or 0)),
        "aspectRatio": round_number(
            float(analysis.get("width", 1))
            / max(float(analysis.get("height", 1)), 1.0)
        ),
        "detectedFaces": len(analysis.get("faces", [])),
        "significantFaces": metrics["significantFaceCount"],
        "extraFaces": metrics["extraFaces"],
        "exactPair": metrics["exactPair"],
        "landscapeScore": round_number(metrics["landscape"]),
        "safeCropScore": round_number(metrics["safeCrop"]),
        "faceQualityScore": round_number(metrics["faceQuality"]),
        "faceProminenceScore": round_number(metrics["faceProminence"]),
        "sharpnessScore": round_number(metrics["sharpness"]),
        "exposureScore": round_number(metrics["exposure"]),
    }
    if metrics.get("pairMatchMode"):
        public_metrics["pairMatchMode"] = metrics["pairMatchMode"]
    for key in (
        "pairSimilarityFirst",
        "pairSimilaritySecond",
        "pairSimilarityMin",
        "pairSimilarityAverage",
    ):
        if isinstance(metrics.get(key), (int, float)):
            public_metrics[key] = round_number(metrics[key], 4)
    return public_metrics


def select_gallery_cover(
    gallery: dict[str, Any],
    manifest_directory: Path,
    analyzer: FaceAnalyzer,
    target_aspects: list[float],
) -> dict[str, Any]:
    gallery_images = gallery.get("images")
    if not isinstance(gallery_images, list) or not gallery_images:
        return {
            "version": OUTPUT_VERSION,
            "coverSource": None,
            "coverIndex": -1,
            "coverFocus": None,
            "confidence": 0,
            "method": "no-images",
            "stats": {
                "images": 0,
                "analyzedImages": 0,
                "failedImages": 0,
                "faces": 0,
                "pairAppearances": 0,
            },
        }

    images: list[dict[str, Any]] = []
    failed_images = 0
    for manifest_index, manifest_image in enumerate(gallery_images):
        if not isinstance(manifest_image, dict) or not manifest_image.get("path"):
            failed_images += 1
            continue
        image_path = resolve_image_path(
            str(manifest_image["path"]),
            manifest_directory,
        )
        analysis = analyzer.analyze(image_path)
        if analysis.get("error"):
            failed_images += 1
            continue
        images.append(
            {
                **manifest_image,
                "manifestIndex": manifest_index,
                "resolvedPath": str(image_path),
                "source": manifest_image.get("source") or str(manifest_image["path"]),
                "analysis": analysis,
            }
        )

    if not images:
        return {
            "version": OUTPUT_VERSION,
            "coverSource": None,
            "coverIndex": -1,
            "coverFocus": None,
            "confidence": 0,
            "method": "analysis-failed",
            "stats": {
                "images": len(gallery_images),
                "analyzedImages": 0,
                "failedImages": failed_images,
                "faces": 0,
                "pairAppearances": 0,
            },
        }

    clusters = cluster_identities(images)
    dominant_pair, pair_appearances = find_dominant_pair(images, clusters)
    stable_pair = bool(dominant_pair and pair_appearances >= 3)
    pair_candidates: list[
        tuple[float, dict[str, Any], dict[str, Any], str]
    ] = []
    strict_pair_candidates = 0
    soft_pair_candidates = 0
    exactly_two_candidates: list[
        tuple[float, dict[str, Any], dict[str, Any]]
    ] = []
    landscape_candidates: list[
        tuple[float, dict[str, Any], dict[str, Any]]
    ] = []

    for image in images:
        clustered_faces = faces_by_cluster(image)
        if dominant_pair and all(
            cluster_id in clustered_faces for cluster_id in dominant_pair
        ):
            pair_faces = [
                clustered_faces[dominant_pair[0]],
                clustered_faces[dominant_pair[1]],
            ]
            score, metrics = score_pair_candidate(
                image,
                pair_faces,
                target_aspects,
            )
            metrics["pairMatchMode"] = "strict-cluster"
            pair_candidates.append(
                (score, image, metrics, "dominant-recurring-pair")
            )
            strict_pair_candidates += 1
        elif stable_pair and dominant_pair:
            soft_match = soft_verify_dominant_pair(
                image,
                dominant_pair,
                clusters,
            )
            if soft_match:
                pair_faces, verification_metrics = soft_match
                score, metrics = score_pair_candidate(
                    image,
                    pair_faces,
                    target_aspects,
                )
                metrics.update(verification_metrics)
                pair_candidates.append(
                    (
                        max(0.0, score - SOFT_PAIR_SCORE_PENALTY),
                        image,
                        metrics,
                        "dominant-recurring-pair-soft",
                    )
                )
                soft_pair_candidates += 1

        visible_faces = significant_faces(image)
        if len(visible_faces) == 2:
            score, metrics = score_fallback_candidate(
                image,
                visible_faces,
                exactly_two=True,
                target_aspects=target_aspects,
            )
            exactly_two_candidates.append((score, image, metrics))

        analysis = image["analysis"]
        if float(analysis.get("width", 0)) >= float(analysis.get("height", 1)):
            focus_faces = visible_faces[:4]
            score, metrics = score_fallback_candidate(
                image,
                focus_faces,
                exactly_two=len(visible_faces) == 2,
                target_aspects=target_aspects,
            )
            landscape_candidates.append((score, image, metrics))

    if pair_candidates:
        score, selected, selected_metrics, method = max(
            pair_candidates,
            key=lambda candidate: candidate[0],
        )
    elif exactly_two_candidates:
        score, selected, selected_metrics = max(
            exactly_two_candidates,
            key=lambda candidate: candidate[0],
        )
        method = "fallback-exactly-two-faces"
    elif landscape_candidates:
        score, selected, selected_metrics = max(
            landscape_candidates,
            key=lambda candidate: candidate[0],
        )
        method = "fallback-landscape"
    else:
        fallback_candidates = []
        for image in images:
            visible_faces = significant_faces(image)
            candidate_score, metrics = score_fallback_candidate(
                image,
                visible_faces[:4],
                exactly_two=len(visible_faces) == 2,
                target_aspects=target_aspects,
            )
            fallback_candidates.append((candidate_score, image, metrics))
        score, selected, selected_metrics = max(
            fallback_candidates,
            key=lambda candidate: candidate[0],
        )
        method = "fallback-best-available"

    total_faces = sum(
        len(image["analysis"].get("faces", [])) for image in images
    )
    recurring_clusters = sum(
        1 for cluster in clusters if len(cluster["imageIndices"]) >= 2
    )
    pair_candidate_diagnostics = [
        {
            "source": image["source"],
            "index": image["manifestIndex"],
            "score": round_number(candidate_score),
            "matchMode": metrics.get("pairMatchMode", "strict-cluster"),
            "aspectRatio": round_number(
                float(image["analysis"].get("width", 1))
                / max(float(image["analysis"].get("height", 1)), 1.0)
            ),
            **(
                {
                    "similarityMin": round_number(
                        metrics["pairSimilarityMin"],
                        4,
                    ),
                    "similarityAverage": round_number(
                        metrics["pairSimilarityAverage"],
                        4,
                    ),
                }
                if isinstance(metrics.get("pairSimilarityMin"), (int, float))
                else {}
            ),
        }
        for candidate_score, image, metrics, _method in sorted(
            pair_candidates,
            key=lambda candidate: candidate[0],
            reverse=True,
        )[:8]
    ]
    return {
        "version": OUTPUT_VERSION,
        "coverSource": selected["source"],
        "coverIndex": selected["manifestIndex"],
        "coverFocus": {
            "source": selected["source"],
            "method": "faces",
            **selected_metrics["focus"],
            "width": int(selected["analysis"].get("width", 0)),
            "height": int(selected["analysis"].get("height", 0)),
            "faceCount": (
                2
                if method.startswith("dominant-recurring-pair")
                else selected_metrics["significantFaceCount"]
            ),
        },
        "confidence": round_number(score / 100, 4),
        "method": method,
        "stats": {
            "images": len(gallery_images),
            "analyzedImages": len(images),
            "failedImages": failed_images,
            "faces": total_faces,
            "identityClusters": len(clusters),
            "recurringIdentityClusters": recurring_clusters,
            "pairAppearances": pair_appearances,
            "pairCandidates": len(pair_candidates),
            "strictPairCandidates": strict_pair_candidates,
            "softPairCandidates": soft_pair_candidates,
            "pairCandidateDiagnostics": pair_candidate_diagnostics,
            "exactlyTwoFaceCandidates": len(exactly_two_candidates),
            "landscapeCandidates": len(landscape_candidates),
            "selected": public_selected_metrics(selected, selected_metrics),
        },
    }


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Select couple-aware gallery covers with YuNet and SFace."
    )
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output")
    parser.add_argument(
        "--detector",
        "--detector-model",
        dest="detector",
        required=True,
    )
    parser.add_argument(
        "--recognizer",
        "--recognizer-model",
        dest="recognizer",
        required=True,
    )
    parser.add_argument(
        "--cache-dir",
        help=(
            "Local directory for cached detections and embeddings. "
            "Do not publish it."
        ),
    )
    parser.add_argument(
        "--cache",
        help="Legacy direct path to the local cache JSON file.",
    )
    parser.add_argument("--max-dimension", type=int, default=960)
    parser.add_argument("--detector-threshold", type=float, default=0.6)
    return parser.parse_args()


def main() -> None:
    started_at = time.perf_counter()
    args = parse_arguments()
    manifest, manifest_directory = read_json(args.manifest)
    manifest_galleries = manifest.get("galleries")
    if isinstance(manifest_galleries, list):
        galleries = manifest_galleries
        multi_gallery_manifest = True
    elif isinstance(manifest.get("images"), list):
        galleries = [
            {
                "id": manifest.get("galleryId"),
                "images": manifest["images"],
            }
        ]
        multi_gallery_manifest = False
    else:
        raise ValueError(
            "Manifest must contain an images array or a galleries array"
        )
    raw_target_aspects = manifest.get("targetAspects")
    target_aspects = [
        float(value)
        for value in (
            raw_target_aspects
            if isinstance(raw_target_aspects, list)
            else DEFAULT_TARGET_ASPECTS
        )
        if isinstance(value, (int, float)) and float(value) > 0
    ] or DEFAULT_TARGET_ASPECTS

    detector_model = Path(args.detector).expanduser().resolve()
    recognizer_model = Path(args.recognizer).expanduser().resolve()
    if not detector_model.is_file():
        raise FileNotFoundError(f"Detector model not found: {detector_model}")
    if not recognizer_model.is_file():
        raise FileNotFoundError(f"Recognizer model not found: {recognizer_model}")

    algorithm_signature = "|".join(
        [
            DETECTION_CACHE_VERSION,
            model_signature(detector_model),
            model_signature(recognizer_model),
            f"max:{max(320, args.max_dimension)}",
            f"threshold:{args.detector_threshold:.6f}",
        ]
    )
    if args.cache:
        cache_file = Path(args.cache).expanduser().resolve()
    elif args.cache_dir:
        cache_file = (
            Path(args.cache_dir).expanduser().resolve()
            / "analysis-cache.json"
        )
    else:
        raise ValueError("Either --cache-dir or --cache is required")
    cache = AnalysisCache(str(cache_file), algorithm_signature)
    analyzer = FaceAnalyzer(
        detector_model,
        recognizer_model,
        cache,
        args.max_dimension,
        args.detector_threshold,
    )

    results = [
        select_gallery_cover(
            gallery,
            manifest_directory,
            analyzer,
            [
                float(value)
                for value in (
                    gallery.get("targetAspects", target_aspects)
                    if isinstance(gallery, dict)
                    else target_aspects
                )
                if isinstance(value, (int, float)) and float(value) > 0
            ]
            or target_aspects,
        )
        for gallery in galleries
    ]
    cache.save()
    elapsed_ms = round_number(
        (time.perf_counter() - started_at) * 1000,
        1,
    )

    if args.output:
        legacy_results = []
        for gallery, result in zip(galleries, results):
            stats = result.get("stats", {})
            legacy_results.append(
                {
                    "id": gallery.get("id"),
                    "selectedSource": result.get("coverSource"),
                    "focus": result.get("coverFocus"),
                    "score": round_number(
                        float(result.get("confidence", 0)) * 100
                    ),
                    "method": result.get("method", "none"),
                    "pairAppearances": int(stats.get("pairAppearances", 0)),
                    "candidateStats": {
                        **stats,
                        "imageCount": stats.get("images", 0),
                        "facesDetected": stats.get("faces", 0),
                    },
                }
            )
        write_json(
            args.output,
            {
                "algorithm": ALGORITHM_VERSION,
                "galleries": legacy_results,
                "summary": {
                    "galleryCount": len(galleries),
                    "selectedCount": sum(
                        1
                        for result in results
                        if result.get("coverSource")
                    ),
                    "cacheHits": cache.hits,
                    "cacheMisses": cache.misses,
                    "elapsedMs": elapsed_ms,
                },
            },
        )
        return

    if multi_gallery_manifest or len(results) != 1:
        raise ValueError(
            "A multi-gallery manifest requires --output"
        )
    result = results[0]
    result["stats"]["cacheHits"] = cache.hits
    result["stats"]["cacheMisses"] = cache.misses
    result["stats"]["elapsedMs"] = elapsed_ms
    json.dump(result, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
