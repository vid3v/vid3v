export function markerStart(section) {
  return `<!-- PROFILE:START:${section} -->`;
}

export function markerEnd(section) {
  return `<!-- PROFILE:END:${section} -->`;
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

export function replaceBlock(readme, section, content) {
  const start = markerStart(section);
  const end = markerEnd(section);
  const pairs = countOccurrences(readme, start);
  const ends = countOccurrences(readme, end);

  if (pairs !== 1 || ends !== 1) {
    throw new Error(
      `Markers for ${section} must appear exactly once (found ${pairs} start / ${ends} end)`
    );
  }

  const startIndex = readme.indexOf(start);
  const endIndex = readme.indexOf(end);
  if (endIndex < startIndex) {
    throw new Error(`Markers for ${section} are malformed`);
  }

  return `${readme.slice(0, startIndex)}${start}\n${content.trimEnd()}\n${readme.slice(endIndex)}`;
}
