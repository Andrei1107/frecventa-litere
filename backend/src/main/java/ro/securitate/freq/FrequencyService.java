package ro.securitate.freq;

import org.apache.tika.exception.TikaException;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.pdf.PDFParserConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.xml.sax.SAXException;
import org.xml.sax.helpers.DefaultHandler;
import ro.securitate.freq.Models.*;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;

@Service
public class FrequencyService {

    private static final Logger log = LoggerFactory.getLogger(FrequencyService.class);

    /** Cele 31 de litere ale alfabetului românesc (litere mici), în ordine alfabetică. */
    static final List<String> ROMANIAN_ALPHABET = List.of(
            "a", "ă", "â", "b", "c", "d", "e", "f", "g", "h", "i", "î", "j", "k", "l", "m",
            "n", "o", "p", "q", "r", "s", "ș", "t", "ț", "u", "v", "w", "x", "y", "z");

    private static final boolean[] IS_VOWEL = new boolean[31];
    private static final AutoDetectParser PARSER = new AutoDetectParser();
    private static final PDFParserConfig PDF_CONFIG = new PDFParserConfig();

    static {
        // Vocale: a(0), ă(1), â(2), e(6), i(10), î(11), o(17), u(25)
        for (int idx : new int[]{0, 1, 2, 6, 10, 11, 17, 25}) {
            IS_VOWEL[idx] = true;
        }
        // Dezactivează OCR (Tesseract), imagini, fonturi și unghiuri din PDF-uri pentru viteză maximă
        PDF_CONFIG.setOcrStrategy(PDFParserConfig.OCR_STRATEGY.NO_OCR);
        PDF_CONFIG.setExtractInlineImages(false);
        PDF_CONFIG.setExtractUniqueInlineImagesOnly(false);
        PDF_CONFIG.setExtractActions(false);
        PDF_CONFIG.setExtractBookmarksText(false);
        PDF_CONFIG.setExtractFontNames(false);
        PDF_CONFIG.setDetectAngles(false);
    }

    /**
     * Extrage textul cu Apache Tika și numără literele direct în flux (streaming, zero alocări
     * de String-uri sau HashMap), ideal pentru containere cu CPU/RAM limitat (ex. Render Free).
     */
    public AnalysisResult extractAndAnalyze(String fileName, InputStream in)
            throws IOException, TikaException, SAXException {
        long t0 = System.currentTimeMillis();
        long[] counts = new long[31];
        long[] rawChars = {0};

        DefaultHandler streamingCounter = new DefaultHandler() {
            int lastIdx = -1;

            @Override
            public void characters(char[] ch, int start, int length) {
                rawChars[0] += length;
                int end = start + length;
                for (int i = start; i < end; i++) {
                    char c = ch[i];
                    int combined = combineDiacritic(lastIdx, c);
                    if (combined != -1) {
                        counts[lastIdx]--;
                        counts[combined]++;
                        lastIdx = combined;
                        continue;
                    }
                    int idx = letterIndex(c);
                    if (idx != -1) {
                        counts[idx]++;
                        lastIdx = idx;
                    } else {
                        lastIdx = -1;
                    }
                }
            }
        };

        ParseContext context = new ParseContext();
        context.set(PDFParserConfig.class, PDF_CONFIG);
        PARSER.parse(in, streamingCounter, new Metadata(), context);

        long extractMs = System.currentTimeMillis() - t0;
        log.info("[TIKA-STREAM] '{}' parsat si contorizat in flux in {} ms ({} caractere brute)",
                fileName, extractMs, rawChars[0]);

        return buildResult(fileName, counts);
    }

    public AnalysisResult analyze(String fileName, String text) {
        long[] counts = new long[31];
        int lastIdx = -1;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            int combined = combineDiacritic(lastIdx, c);
            if (combined != -1) {
                counts[lastIdx]--;
                counts[combined]++;
                lastIdx = combined;
                continue;
            }
            int idx = letterIndex(c);
            if (idx != -1) {
                counts[idx]++;
                lastIdx = idx;
            } else {
                lastIdx = -1;
            }
        }
        return buildResult(fileName, counts);
    }

    private AnalysisResult buildResult(String fileName, long[] counts) {
        long total = 0;
        long vowels = 0;
        int distinct = 0;
        for (int i = 0; i < 31; i++) {
            long n = counts[i];
            total += n;
            if (n > 0) distinct++;
            if (IS_VOWEL[i]) vowels += n;
        }
        List<LetterStat> stats = new ArrayList<>(31);
        List<String> missing = new ArrayList<>();
        for (int i = 0; i < 31; i++) {
            String l = ROMANIAN_ALPHABET.get(i);
            long n = counts[i];
            double p = total == 0 ? 0 : (double) n / total;
            stats.add(new LetterStat(l, n, p));
            if (n == 0) missing.add(l);
        }
        long consonants = total - vowels;
        double vowelRatio = total == 0 ? 0 : (double) vowels / total;
        return new AnalysisResult(fileName, total, distinct, missing,
                vowels, consonants, vowelRatio, stats);
    }

    public ComparisonResult compare(AnalysisResult a, AnalysisResult b) {
        Map<String, LetterStat> ma = new HashMap<>();
        Map<String, LetterStat> mb = new HashMap<>();
        a.letters().forEach(s -> ma.put(s.letter(), s));
        b.letters().forEach(s -> mb.put(s.letter(), s));

        List<LetterDiff> diffs = new ArrayList<>(31);
        List<String> onlyA = new ArrayList<>();
        List<String> onlyB = new ArrayList<>();
        for (String l : ROMANIAN_ALPHABET) {
            LetterStat sa = ma.get(l), sb = mb.get(l);
            long ca = sa == null ? 0 : sa.absolute();
            long cb = sb == null ? 0 : sb.absolute();
            double pa = sa == null ? 0 : sa.relative();
            double pb = sb == null ? 0 : sb.relative();
            diffs.add(new LetterDiff(l, pa, pb, (pb - pa) * 100));
            if (ca > 0 && cb == 0) onlyA.add(l);
            if (cb > 0 && ca == 0) onlyB.add(l);
        }
        double vowelDiff = (b.vowelRatio() - a.vowelRatio()) * 100;
        return new ComparisonResult(a, b, diffs, onlyA, onlyB, vowelDiff);
    }

    /** Tratează diacriticele descompuse Unicode NFD (ex: 'a' + căciulă combinată -> 'ă'). */
    private static int combineDiacritic(int lastIdx, char mark) {
        return switch (mark) {
            case '\u0306' -> lastIdx == 0 ? 1 : -1; // 'a' + breve -> 'ă'
            case '\u0302' -> lastIdx == 0 ? 2 : (lastIdx == 10 ? 11 : -1); // 'a'/'i' + circumflex -> 'â'/'î'
            case '\u0326', '\u0327', '\u0323' -> lastIdx == 21 ? 22 : (lastIdx == 23 ? 24 : -1); // 's'/'t' + virgulă/sedilă/punct -> 'ș'/'ț'
            default -> -1;
        };
    }

    /**
     * Returnează indexul (0..30) în alfabetul românesc sau -1 dacă nu este literă din alfabet.
     * Unifică ș/ț cu sedilă (ş, ţ) sau cu punct dedesubt (ṣ, ṭ), 'ã' -> 'ă', 'ı' -> 'i'.
     */
    private static int letterIndex(char c) {
        c = Character.toLowerCase(c);
        return switch (c) {
            case 'a' -> 0;
            case 'ă', 'ã' -> 1;
            case 'â' -> 2;
            case 'b' -> 3;
            case 'c' -> 4;
            case 'd' -> 5;
            case 'e' -> 6;
            case 'f' -> 7;
            case 'g' -> 8;
            case 'h' -> 9;
            case 'i', 'ı' -> 10;
            case 'î' -> 11;
            case 'j' -> 12;
            case 'k' -> 13;
            case 'l' -> 14;
            case 'm' -> 15;
            case 'n' -> 16;
            case 'o' -> 17;
            case 'p' -> 18;
            case 'q' -> 19;
            case 'r' -> 20;
            case 's' -> 21;
            case 'ș', 'ş', 'ṣ' -> 22;
            case 't' -> 23;
            case 'ț', 'ţ', 'ṭ' -> 24;
            case 'u' -> 25;
            case 'v' -> 26;
            case 'w' -> 27;
            case 'x' -> 28;
            case 'y' -> 29;
            case 'z' -> 30;
            default -> -1;
        };
    }
}
