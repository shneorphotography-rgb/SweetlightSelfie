import GridGallery from '../layouts/GridGallery';
import MasonryGallery from '../layouts/MasonryGallery';
import StoriesGallery from '../layouts/StoriesGallery';

export default function LayoutEngine({
  layout,
  items,
  columns,
  storyColumns,
  typography,
  onSelectItem,
}) {
  switch (layout) {
    case 'grid':
      return <GridGallery items={items} columns={columns?.desktop || 3} typography={typography} onSelectItem={onSelectItem} />;
    case 'masonry':
      return <MasonryGallery items={items} columns={columns} typography={typography} onSelectItem={onSelectItem} />;
    case 'stories':
      return <StoriesGallery items={items} columns={storyColumns} typography={typography} onSelectItem={onSelectItem} />;
    default:
      return <StoriesGallery items={items} columns={storyColumns} typography={typography} onSelectItem={onSelectItem} />;
  }
}
