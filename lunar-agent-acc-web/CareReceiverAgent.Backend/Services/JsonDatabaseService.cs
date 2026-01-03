using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using CareReceiverAgent.Backend.Models;

namespace CareReceiverAgent.Backend.Services
{
    /// <summary>
    /// JSON 기반 데이터베이스 서비스
    /// </summary>
    public class JsonDatabaseService
    {
        private static string DataDir => Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "data");
        private static string PhrasesPath => Path.Combine(DataDir, "phrases.json");
        private static string SerialSettingsPath => Path.Combine(DataDir, "serial_settings.json");

        static JsonDatabaseService()
        {
            if (!Directory.Exists(DataDir))
            {
                Directory.CreateDirectory(DataDir);
            }
        }

        private static JsonSerializerOptions GetJsonOptions()
        {
            return new JsonSerializerOptions
            {
                WriteIndented = true,
                Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
            };
        }

        public static PhraseDatabase LoadPhrases()
        {
            try
            {
                if (File.Exists(PhrasesPath))
                {
                    string json = File.ReadAllText(PhrasesPath, System.Text.Encoding.UTF8);
                    var db = JsonSerializer.Deserialize<PhraseDatabase>(json, GetJsonOptions());
                    if (db != null)
                    {
                        return db;
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"문구 데이터 로드 실패: {ex.Message}");
            }

            return new PhraseDatabase();
        }

        public static void SavePhrases(PhraseDatabase database)
        {
            try
            {
                string json = JsonSerializer.Serialize(database, GetJsonOptions());
                File.WriteAllText(PhrasesPath, json, System.Text.Encoding.UTF8);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"문구 데이터 저장 실패: {ex.Message}");
            }
        }

        public static SerialSettings LoadSerialSettings()
        {
            try
            {
                if (File.Exists(SerialSettingsPath))
                {
                    string json = File.ReadAllText(SerialSettingsPath, System.Text.Encoding.UTF8);
                    var settings = JsonSerializer.Deserialize<SerialSettings>(json, GetJsonOptions());
                    if (settings != null)
                    {
                        return settings;
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"시리얼 설정 로드 실패: {ex.Message}");
            }

            return new SerialSettings();
        }

        public static void SaveSerialSettings(SerialSettings settings)
        {
            try
            {
                string json = JsonSerializer.Serialize(settings, GetJsonOptions());
                File.WriteAllText(SerialSettingsPath, json, System.Text.Encoding.UTF8);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"시리얼 설정 저장 실패: {ex.Message}");
            }
        }
    }
}

