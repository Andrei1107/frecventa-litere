package ro.securitate.freq;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import ro.securitate.freq.Models.*;

import java.io.InputStream;
import java.io.SequenceInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class AnalysisController {

    private static final Logger log = LoggerFactory.getLogger(AnalysisController.class);

    private final FrequencyService service;

    public AnalysisController(FrequencyService service) {
        this.service = service;
    }

    @PostMapping("/analyze")
    public AnalysisResult analyze(@RequestParam("file") MultipartFile file) {
        String name = file.getOriginalFilename() == null ? "fisier" : file.getOriginalFilename();
        long sizeKb = file.getSize() / 1024;
        log.info("[ANALYZE-START] Fisier primit: '{}' ({} KB, contentType={})",
                name, sizeKb, file.getContentType());

        if (file.isEmpty()) {
            log.warn("[ANALYZE-WARN] Fisierul '{}' este gol.", name);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fișier gol.");
        }
        long t0 = System.currentTimeMillis();
        try (var in = file.getInputStream()) {
            String text = service.extractText(name, in);
            AnalysisResult res = service.analyze(name, text);
            long elapsed = System.currentTimeMillis() - t0;
            log.info("[ANALYZE-DONE] '{}' procesat complet in {} ms -> N_total={}, distincte={}/31, vocale={} ({}%), consoane={} ({}%), lipsa={}",
                    name, elapsed, res.totalLetters(), res.distinctLetters(),
                    res.vowels(), String.format("%.2f", res.vowelRatio() * 100),
                    res.consonants(), String.format("%.2f", (1 - res.vowelRatio()) * 100),
                    res.missingRomanianLetters());
            return res;
        } catch (Exception e) {
            log.error("[ANALYZE-ERROR] Eroare la procesarea fisierului '{}': {}", name, e.getMessage(), e);
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Nu am putut citi fișierul: " + e.getMessage());
        }
    }

    /**
     * Upload paralel pe bucăți: fragmentele 0..total-2 se încarcă în paralel,
     * iar fragmentul final (index == total - 1) le îmbină și declanșează analiza.
     */
    @PostMapping("/analyze/chunk")
    public ResponseEntity<AnalysisResult> analyzeChunk(
            @RequestParam("uploadId") String uploadId,
            @RequestParam("fileName") String fileName,
            @RequestParam("index") int index,
            @RequestParam("total") int total,
            @RequestParam("chunk") MultipartFile chunk) {
        String safeId = uploadId.replaceAll("[^a-zA-Z0-9_-]", "");
        Path tmpDir = Path.of(System.getProperty("java.io.tmpdir"));
        Path partFile = tmpDir.resolve("freq_" + safeId + "_" + index + ".part");
        long chunkKb = chunk.getSize() / 1024;

        try {
            chunk.transferTo(partFile);
            log.info("[CHUNK-RECEIVED] '{}' (uploadId={}) -> fragment {}/{} salvat ({} KB)",
                    fileName, safeId, index + 1, total, chunkKb);

            if (index < total - 1) {
                return ResponseEntity.accepted().build();
            }

            log.info("[CHUNK-MERGE] Toate cele {} fragmente pentru '{}' (uploadId={}) au sosit. Incepe imbinarea si analiza...",
                    total, fileName, safeId);
            long t0 = System.currentTimeMillis();
            List<Path> parts = new ArrayList<>(total);
            List<InputStream> streams = new ArrayList<>(total);
            try {
                for (int i = 0; i < total; i++) {
                    Path p = tmpDir.resolve("freq_" + safeId + "_" + i + ".part");
                    parts.add(p);
                    streams.add(Files.newInputStream(p));
                }
                try (InputStream combined = new SequenceInputStream(Collections.enumeration(streams))) {
                    String text = service.extractText(fileName, combined);
                    AnalysisResult res = service.analyze(fileName, text);
                    long elapsed = System.currentTimeMillis() - t0;
                    log.info("[CHUNK-DONE] '{}' (din {} fragmente) analizat in {} ms -> N_total={}, distincte={}/31, vocale={}%, lipsa={}",
                            fileName, total, elapsed, res.totalLetters(), res.distinctLetters(),
                            String.format("%.2f", res.vowelRatio() * 100), res.missingRomanianLetters());
                    return ResponseEntity.ok(res);
                }
            } finally {
                for (InputStream s : streams) {
                    try { s.close(); } catch (Exception ignored) {}
                }
                for (Path p : parts) {
                    try { Files.deleteIfExists(p); } catch (Exception ignored) {}
                }
                log.info("[CHUNK-CLEANUP] Fisierele temporare pentru '{}' (uploadId={}) au fost sterse.", fileName, safeId);
            }
        } catch (Exception e) {
            log.error("[CHUNK-ERROR] Eroare la fragmentul {}/{} pentru '{}' (uploadId={}): {}",
                    index + 1, total, fileName, safeId, e.getMessage(), e);
            for (int i = 0; i < total; i++) {
                try { Files.deleteIfExists(tmpDir.resolve("freq_" + safeId + "_" + i + ".part")); } catch (Exception ignored) {}
            }
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Nu am putut citi fișierul: " + e.getMessage());
        }
    }

    @PostMapping("/compare")
    public ComparisonResult compare(@RequestBody CompareRequest req) {
        if (req.a() == null || req.b() == null) {
            log.warn("[COMPARE-WARN] Cerere de comparare invalida (unul dintre fisiere lipseste).");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sunt necesare două analize.");
        }
        log.info("[COMPARE-START] Comparare intre A='{}' (N={}) si B='{}' (N={})",
                req.a().fileName(), req.a().totalLetters(),
                req.b().fileName(), req.b().totalLetters());
        long t0 = System.currentTimeMillis();
        ComparisonResult res = service.compare(req.a(), req.b());
        long elapsed = System.currentTimeMillis() - t0;
        log.info("[COMPARE-DONE] Comparare '{}' vs '{}' finalizata in {} ms -> deltaVocale={} pp, doarInA={}, doarInB={}",
                req.a().fileName(), req.b().fileName(), elapsed,
                String.format("%+.2f", res.vowelRatioDiffPercentPoints()),
                res.onlyInA(), res.onlyInB());
        return res;
    }
}
