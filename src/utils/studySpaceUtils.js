export function filterStudySpaces(
  studySpaces,
  ratingSummaries = {},
  {
    search = "",
    studyMode = "",
    minimumRating = "",
    indoorOnly = false,
    wifiOnly = false,
    powerOutletsOnly = false,
  } = {}
) {
  const searchKeywords = search
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const normalizedMode = studyMode.trim().toLowerCase();
  const minimumRatingValue = Number(minimumRating) || 0;

  return studySpaces.filter((space) => {
    const searchableText = `${space.name || ""} ${space.address || ""}`.toLowerCase();
    const spaceMode = space.studyMode?.trim().toLowerCase() || "";
    const averageRating = ratingSummaries[space.id]?.averageRating;

    return (
      searchKeywords.every((keyword) => searchableText.includes(keyword)) &&
      (!normalizedMode || spaceMode === normalizedMode) &&
      (!minimumRatingValue || averageRating >= minimumRatingValue) &&
      (!indoorOnly || space.indoor === true) &&
      (!wifiOnly || space.wifi === true) &&
      (!powerOutletsOnly || space.powerOutlets === true)
    );
  });
}
