"""Detect the primary faces in cover images and return normalized safe areas.

The script is intentionally a build/dev-time helper. The browser only receives
the resulting focal point, so cover behavior remains identical across browsers.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np


MAX_DETECTION_DIMENSION = 1600
MIN_RELATIVE_FACE_AREA = 0.12
SAFE_PADDING_X = 0.35
SAFE_PADDING_TOP = 0.45
SAFE_PADDING_BOTTOM = 0.35


def round_number(value: float) -> float:
    return round(float(value), 3)


def read_image(image_path: Path):
    """Read paths containing Hebrew/Unicode reliably on Windows."""
    encoded = np.fromfile(str(image_path), dtype=np.uint8)
    if encoded.size == 0:
        return None
    return cv2.imdecode(encoded, cv2.IMREAD_COLOR)


def create_detector(model_path: Path, width: int, height: int, threshold: float):
    # OpenCV's Windows DNN loader cannot open model paths containing Hebrew.
    # Copy only the small model to an ASCII-only temp path when necessary.
    try:
        str(model_path).encode("ascii")
        compatible_model_path = model_path
    except UnicodeEncodeError:
        cache_directory = Path(tempfile.gettempdir()) / "portfolio-face-models"
        cache_directory.mkdir(parents=True, exist_ok=True)
        compatible_model_path = cache_directory / model_path.name
        if (
            not compatible_model_path.exists()
            or compatible_model_path.stat().st_size != model_path.stat().st_size
        ):
            shutil.copyfile(model_path, compatible_model_path)

    return cv2.FaceDetectorYN.create(
        str(compatible_model_path),
        "",
        (width, height),
        threshold,
        0.3,
        5000,
    )


def detect_image(image_path: Path, model_path: Path, threshold: float):
    image = read_image(image_path)
    if image is None:
        return {
            "path": str(image_path),
            "error": "Image could not be decoded",
        }

    source_height, source_width = image.shape[:2]
    scale = min(1.0, MAX_DETECTION_DIMENSION / max(source_width, source_height))

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

    detector = create_detector(model_path, working_width, working_height, threshold)
    _, detected = detector.detect(working_image)

    if detected is None or len(detected) == 0:
        return {
            "path": str(image_path),
            "method": "none",
            "width": source_width,
            "height": source_height,
            "faceCount": 0,
        }

    candidates = []
    for face in detected:
        x, y, width, height = (float(value) / scale for value in face[:4])
        score = float(face[-1])
        candidates.append(
            {
                "x": max(0.0, x),
                "y": max(0.0, y),
                "width": min(float(source_width), width),
                "height": min(float(source_height), height),
                "score": score,
            }
        )

    largest_area = max(face["width"] * face["height"] for face in candidates)
    primary_faces = [
        face
        for face in candidates
        if face["width"] * face["height"] >= largest_area * MIN_RELATIVE_FACE_AREA
    ]
    primary_faces.sort(key=lambda face: face["score"], reverse=True)
    primary_faces = primary_faces[:12]

    left = min(face["x"] for face in primary_faces)
    top = min(face["y"] for face in primary_faces)
    right = max(face["x"] + face["width"] for face in primary_faces)
    bottom = max(face["y"] + face["height"] for face in primary_faces)
    largest_width = max(face["width"] for face in primary_faces)
    largest_height = max(face["height"] for face in primary_faces)

    safe_left = max(0.0, left - largest_width * SAFE_PADDING_X)
    safe_top = max(0.0, top - largest_height * SAFE_PADDING_TOP)
    safe_right = min(float(source_width), right + largest_width * SAFE_PADDING_X)
    safe_bottom = min(
        float(source_height),
        bottom + largest_height * SAFE_PADDING_BOTTOM,
    )

    focus_x = (left + right) / 2 / source_width * 100
    focus_y = (top + bottom) / 2 / source_height * 100

    return {
        "path": str(image_path),
        "method": "faces",
        "width": source_width,
        "height": source_height,
        "faceCount": len(primary_faces),
        "x": round_number(focus_x),
        "y": round_number(focus_y),
        "safeArea": {
            "left": round_number(safe_left / source_width * 100),
            "top": round_number(safe_top / source_height * 100),
            "right": round_number(safe_right / source_width * 100),
            "bottom": round_number(safe_bottom / source_height * 100),
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--threshold", type=float, default=0.6)
    parser.add_argument("images", nargs="+")
    args = parser.parse_args()

    model_path = Path(args.model).resolve()
    if not model_path.is_file():
        raise FileNotFoundError(f"Face detection model not found: {model_path}")

    results = [
        detect_image(Path(image_path).resolve(), model_path, args.threshold)
        for image_path in args.images
    ]
    json.dump(results, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
