package ro.securitate.freq;

import org.apache.tika.exception.TikaException;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.pdf.PDFParserConfig;
import org.apache.tika.sax.BodyContentHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.xml.sax.SAXException;
import ro.securitate.freq.Models.*;

import java.io.IOException;
import java.io.InputStream;
import java.text.Normalizer;
import java.util.*;

@Service
public class FrequencyService {

    private static final Logger log = LoggerFactory.getLogger(FrequencyService.class);

    /** Cele 31 de litere ale alfabetului românesc (litere mici), în ordine alfabetică. */
    static final List<String> ROMANIAN_ALPHABET = List.of(
            "a", "ă", "â", "b", "c", "d", "e", "f", "g", "h", "i", "î", "j", "k", "l", "m",
            "n", "o", "p", "q", "r", "s", "ș", "t", "ț", "u", "v", "w", "x", "y", "z");

    private static final Set<Character> ROMANIAN_CHARS = Set.of(
            'a', 'ă', 'â', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'î', 'j', 'k', 'l', 'm',
            'n', 'o', 'p', 'q', 'r', 's', 'ș', 't', 'ț', 'u', 'v', 'w', 'x', 'y', 'z');
    private static final Set<Character> VOWELS = Set.of('a', 'ă', 'â', 'e', 'i', 'î', 'o', 'u');
    private static final AutoDetectParser PARSER = new AutoDetectParser();
    private static final PDFParserConfig PDF_CONFIG = new PDFParserConfig();

    static {
        // Dezactivează OCR (Tesseract) și extragerea imaginilor din PDF-uri pentru viteză maximă
        PDF_CONFIG.setOcrStrategy(PDFParserConfig.OCR_STRATEGY.NO_OCR);
        PDF_CONFIG.setExtractInlineImages(false);
        PDF_CONFIG.setExtractUniqueInlineImagesOnly(false);
    }

    /** Extrage textul din orice format suportat de Tika (pdf, doc, docx, txt, ...). */
    public synchronized String extractText(String fileName, InputStream in) throws IOException, TikaException, SAXException {
        long t0 = System.currentTimeMillis();
        BodyContentHandler handler = new BodyContentHandler(-1); // fără limită de dimensiune
        ParseContext context = new ParseContext();
        context.set(PDFParserConfig.class, PDF_CONFIG);
        PARSER.parse(in, handler, new Metadata(), context);
        String extracted = handler.toString();
        long elapsed = System.currentTimeMillis() - t0;
        log.info("[TIKA-EXTRACT] Text extras din '{}' in {} ms ({} caractere brute)",
                fileName, elapsed, extracted.length());
        return extracted;
    }

    public AnalysisResult analyze(String fileName, String text) {
        // Compune caracterele descompuse (NFD -> NFC), frecvente pe macOS și în PDF-uri
        // (ex: 'a' + căciulă combinată devine un singur char 'ă').
        text = Normalizer.normalize(text, Normalizer.Form.NFC);
        Map<Character, Long> counts = new HashMap<>();
        long total = 0;
        for (int i = 0; i < text.length(); i++) {
            char c = normalize(text.charAt(i));
            if (!ROMANIAN_CHARS.contains(c)) continue; // păstrează strict cele 31 de litere (A-Z + ă, â, î, ș, ț)
            counts.put(c, counts.getOrDefault(c, 0L) + 1);
            total++;
        }

        List<LetterStat> stats = new ArrayList<>();
        List<String> missing = new ArrayList<>();
        long vowels = 0;
        for (String l : ROMANIAN_ALPHABET) {
            long n = counts.getOrDefault(l.charAt(0), 0L);
            double p = total == 0 ? 0 : (double) n / total;
            stats.add(new LetterStat(l, n, p));
            if (n == 0) missing.add(l);
            if (VOWELS.contains(l.charAt(0))) vowels += n;
        }
        long consonants = total - vowels;
        int distinct = (int) counts.size();
        double vowelRatio = total == 0 ? 0 : (double) vowels / total;
        return new AnalysisResult(fileName, total, distinct, missing,
                vowels, consonants, vowelRatio, stats);
    }

    public ComparisonResult compare(AnalysisResult a, AnalysisResult b) {
        Map<String, LetterStat> ma = new HashMap<>();
        Map<String, LetterStat> mb = new HashMap<>();
        a.letters().forEach(s -> ma.put(s.letter(), s));
        b.letters().forEach(s -> mb.put(s.letter(), s));

        List<LetterDiff> diffs = new ArrayList<>();
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

    /**
     * Lowercase + unificarea variantelor de diacritice românești:
     * - cu sedilă (ş, ţ) sau cu punct dedesubt (ṣ, ṭ) -> cu virgulă (ș, ț)
     * - 'ã' (folosit în encodări românești vechi) -> 'ă'
     * - 'ı' (i fără punct din OCR) -> 'i'
     */
    private static char normalize(char c) {
        c = Character.toLowerCase(c);
        return switch (c) {
            case 'ş', 'ṣ' -> 'ș';
            case 'ţ', 'ṭ' -> 'ț';
            case 'ã' -> 'ă';
            case 'ı' -> 'i';
            default -> c;
        };
    }
}
