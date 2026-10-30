package ro.securitate.freq;

import java.util.List;

/** DTO-uri returnate de API. */
public final class Models {
    private Models() {}

    public record LetterStat(String letter, long absolute, double relative) {}

    public record AnalysisResult(
            String fileName,
            long totalLetters,
            int distinctLetters,
            List<String> missingRomanianLetters,
            List<String> extraLetters,
            long vowels,
            long consonants,
            double vowelRatio,
            List<LetterStat> letters) {}

    public record LetterDiff(String letter, double relativeA, double relativeB, double diffPercentPoints) {}

    public record CompareRequest(AnalysisResult a, AnalysisResult b) {}

    public record ComparisonResult(
            AnalysisResult a,
            AnalysisResult b,
            List<LetterDiff> diffs,
            List<String> onlyInA,
            List<String> onlyInB,
            double vowelRatioDiffPercentPoints,
            double cosineSimilarity,
            double totalVariationDistance,
            String summary) {}
}
