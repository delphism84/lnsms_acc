using CareReceiverAgent.Backend.Models;
using CareReceiverAgent.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace CareReceiverAgent.Backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PhrasesController : ControllerBase
    {

        [HttpGet]
        public ActionResult<PhraseDatabase> GetPhrases()
        {
            var database = JsonDatabaseService.LoadPhrases();
            // JSON 속성명을 소문자로 맞춤 (프론트엔드와 일치)
            return Ok(new { Phrases = database.Phrases });
        }

        [HttpPost]
        public ActionResult<PhraseModel> CreatePhrase([FromBody] PhraseModel phrase)
        {
            var database = JsonDatabaseService.LoadPhrases();
            
            if (phrase.Id == 0)
            {
                phrase.Id = database.Phrases.Count > 0 
                    ? database.Phrases.Max(p => p.Id) + 1 
                    : 1;
            }

            phrase.CreatedAt = DateTime.Now;
            phrase.UpdatedAt = DateTime.Now;
            
            database.Phrases.Add(phrase);
            JsonDatabaseService.SavePhrases(database);
            
            return Ok(phrase);
        }

        [HttpPut("{id}")]
        public ActionResult<PhraseModel> UpdatePhrase(int id, [FromBody] PhraseModel phrase)
        {
            var database = JsonDatabaseService.LoadPhrases();
            var existing = database.Phrases.FirstOrDefault(p => p.Id == id);
            
            if (existing == null)
            {
                return NotFound();
            }

            existing.Text = phrase.Text;
            existing.IsEnabled = phrase.IsEnabled;
            existing.Color = phrase.Color;
            existing.BellCodes = phrase.BellCodes;
            existing.UpdatedAt = DateTime.Now;
            
            JsonDatabaseService.SavePhrases(database);
            
            return Ok(existing);
        }

        [HttpDelete("{id}")]
        public ActionResult DeletePhrase(int id)
        {
            var database = JsonDatabaseService.LoadPhrases();
            var phrase = database.Phrases.FirstOrDefault(p => p.Id == id);
            
            if (phrase == null)
            {
                return NotFound();
            }

            database.Phrases.Remove(phrase);
            JsonDatabaseService.SavePhrases(database);
            
            return NoContent();
        }
    }
}

