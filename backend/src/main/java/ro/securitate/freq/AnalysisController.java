package ro.securitate.freq;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import ro.securitate.freq.Models.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

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

    /** Upload pe bucăți (1 MB) pentru a trece de limita 413 Payload Too Large a proxy-ului Codespaces. */
    @PostMapping("/analyze/chunk")
    public ResponseEntity<AnalysisResult> analyzeChunk(
            @RequestParam("uploadId") String uploadId,
            @RequestParam("fileName") String fileName,
            @RequestParam("index") int index,
            @RequestParam("total") int total,
            @RequestParam("chunk") MultipartFile chunk) {
        String safeId = uploadId.replaceAll("[^a-zA-Z0-9_-]", "");
        Path tempFile = Path.of(System.getProperty("java.io.tmpdir"), "freq_" + safeId + ".tmp");
        try {
            if (index == 0) {
                Files.deleteIfExists(tempFile);
            }
            Files.write(tempFile, chunk.getBytes(), StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            if (index < total - 1) {
                return ResponseEntity.accepted().build();
            }
            try (var in = Files.newInputStream(tempFile)) {
                String text = service.extractText(in);
                return ResponseEntity.ok(service.analyze(fileName, text));
            } finally {
                Files.deleteIfExists(tempFile);
            }
        } catch (Exception e) {
            try { Files.deleteIfExists(tempFile); } catch (Exception ignored) {}
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
