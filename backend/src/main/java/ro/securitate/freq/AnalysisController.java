package ro.securitate.freq;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import ro.securitate.freq.Models.*;

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

    @PostMapping("/compare")
    public ComparisonResult compare(@RequestBody CompareRequest req) {
        if (req.a() == null || req.b() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sunt necesare două analize.");
        }
        return service.compare(req.a(), req.b());
    }
}
