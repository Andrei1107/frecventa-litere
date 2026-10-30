package ro.securitate.freq;

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

    private final FrequencyService service;

    public AnalysisController(FrequencyService service) {
        this.service = service;
    }

    @PostMapping("/analyze")
    public AnalysisResult analyze(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fișier gol.");
        }
        try (var in = file.getInputStream()) {
            String text = service.extractText(in);
            String name = file.getOriginalFilename() == null ? "fisier" : file.getOriginalFilename();
            return service.analyze(name, text);
        } catch (Exception e) {
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
        try {
            chunk.transferTo(partFile);
            if (index < total - 1) {
                return ResponseEntity.accepted().build();
            }
            List<Path> parts = new ArrayList<>(total);
            List<InputStream> streams = new ArrayList<>(total);
            try {
                for (int i = 0; i < total; i++) {
                    Path p = tmpDir.resolve("freq_" + safeId + "_" + i + ".part");
                    parts.add(p);
                    streams.add(Files.newInputStream(p));
                }
                try (InputStream combined = new SequenceInputStream(Collections.enumeration(streams))) {
                    String text = service.extractText(combined);
                    return ResponseEntity.ok(service.analyze(fileName, text));
                }
            } finally {
                for (InputStream s : streams) {
                    try { s.close(); } catch (Exception ignored) {}
                }
                for (Path p : parts) {
                    try { Files.deleteIfExists(p); } catch (Exception ignored) {}
                }
            }
        } catch (Exception e) {
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sunt necesare două analize.");
        }
        return service.compare(req.a(), req.b());
    }
}
