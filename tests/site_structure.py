"""Run from the repository root: python3 tests/site_structure.py."""
from html.parser import HTMLParser
from pathlib import Path
from collections import Counter

class Site(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack, self.ids, self.parents, self.files, self.tags, self.attrs = [], [], {}, [], {}, {}
    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        identifier = attrs.get('id')
        if identifier:
            self.ids.append(identifier)
            self.tags[identifier] = tag
            self.attrs[identifier] = attrs
            self.parents[identifier] = tuple(item[1] for item in self.stack)
        for key in ('src',):
            value = attrs.get(key, '')
            if value and not value.startswith(('http:', 'https:', 'data:')):
                self.files.append(value.split('?', 1)[0])
        if tag not in ('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'):
            self.stack.append((tag,identifier))
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i][0] == tag:
                self.stack = self.stack[:i]
                break

site = Site()
site.feed(Path('index.html').read_text())
assert not [key for key,count in Counter(site.ids).items() if count > 1], 'Duplicate IDs'
assert site.tags['research-library'] == 'div' and 'hidden' in site.attrs['research-library'], 'The cultural library starts collapsed'
assert site.tags['browseCultureAtlas'] == 'button'
assert site.attrs['browseCultureAtlas']['aria-controls'] == 'research-library'
assert site.attrs['browseCultureAtlas']['aria-expanded'] == 'false'
chapters = ('timeline','map','atlas','visual-insight','color-atlas','global-compare','compare-section','stickman-game')
for identifier in chapters:
    assert 'research-library' in site.parents[identifier], identifier
assert [site.ids.index(identifier) for identifier in chapters] == sorted(site.ids.index(identifier) for identifier in chapters), 'Cultural chapters must follow their 01–08 numbering'
route = ('journey-intro','culture-guide','research-library','journey-explore','journey-intention','galaxy','journey-result','my-works')
assert [site.ids.index(identifier) for identifier in route] == sorted(site.ids.index(identifier) for identifier in route), 'Explore culture after the introduction and before creating'
for identifier in ('timeline','map'):
    assert 'atlas' not in site.parents[identifier], f'{identifier} must not be inside the star map grid'
for identifier in ('journey-intro','journey-explore','journey-intention','galaxy','journey-result','my-works'):
    assert 'research-library' not in site.parents[identifier], identifier
assert all(Path(src).is_file() for src in site.files), 'Missing local asset'
assert 'drawToolsGroup' in site.parents['btnSaveToGalaxy'], 'Finish must remain accessible from the shared toolbar'
assert not set(site.parents['btnSaveToGalaxy']) & {'freeBrushSettings', 'freeDrawingControls', 'coloringPanel'}, 'Both creation methods must support finishing'
assert not {'btnApplyDraw', 'modelViewerCanvas', 'modelControls', 'modelSources'} & set(site.ids), 'The workshop no longer includes 3D preview'
for identifier in ('drawToolbar','galaxyStage','drawingColorDock','colorTray'):
    assert 'paintingDesk' in site.parents[identifier], 'Keep painting controls in the shared desk'
assert site.ids.index('drawToolbar') < site.ids.index('galaxyStage') < site.ids.index('drawingColorDock'), 'Brushes above the artboard, colors below'
assert 'galaxyStage' not in site.parents['colorTray'], 'The picker must not intercept drawing within the canvas layer'
assert not {'referenceDock','dockCount','btnModeBrowse','btnModeDraw','galaxySearch','galaxyCanvas','workCardBrowse'} & set(site.ids), 'No floating reference bar or demo gallery remains'
assert 'journey-references' in site.parents['draftStatus'], 'Draft status stays in the ordinary reference flow'
assert not {'browseGalaxyBefore','browseGalaxyAfter','publishWork','publishStatus','creationGalaxy','closeCreationGalaxy','publishedWorks','galaxyStatus'} & set(site.ids), 'Published gallery, its entrances and publishing controls have been removed'
print('PASS: unique IDs, research section boundaries, main journey visibility, local asset paths')
