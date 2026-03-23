using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using CareReceiverAgent.Host.Models;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// JSON 기반 ?�이?�베?�스 ?�비??
    /// </summary>
    public class JsonDatabaseService
    {
        private static string DataDir => Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "data");
        private static string PhrasesPath => Path.Combine(DataDir, "phrases.json");
        private static string SerialSettingsPath => Path.Combine(DataDir, "serial_settings.json");
        private static string ActiveSetIdPath => Path.Combine(DataDir, "active_setid.json");
        private static string RemoteControlPath => Path.Combine(DataDir, "remote_control.json");
        private static readonly object _loadLock = new object();

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
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
                // Id 필드는 JSON에 저장하지 않음 (uid만 사용)
                Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
            };
        }

        private static bool UseMongo(out string connectionString, out string databaseName)
        {
            var cfg = AppRuntimeConfig.Load();
            connectionString = cfg.MongoConnectionString ?? string.Empty;
            databaseName = cfg.MongoDatabaseName ?? "agent";
            return !string.IsNullOrWhiteSpace(connectionString);
        }

        /// <summary>
        /// 문구 데이터 로드. Mongo 연결 설정 시 MongoDB, 없으면 JSON 파일 사용. assist 벨 코드 없으면 자동 복구.
        /// </summary>
        public static PhraseDatabase LoadPhrases()
        {
            lock (_loadLock)
            {
                PhraseDatabase db;
                if (UseMongo(out var conn, out var dbName))
                {
                    try
                    {
                        db = MongoDatabaseService.LoadPhrases(conn, dbName);
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"MongoDB 문구 로드 실패: {ex.Message}");
                        db = new PhraseDatabase();
                    }
                }
                else
                {
                    db = new PhraseDatabase();
                    try
                    {
                        if (File.Exists(PhrasesPath))
                        {
                            string json = File.ReadAllText(PhrasesPath, System.Text.Encoding.UTF8);
                            var loadedDb = JsonSerializer.Deserialize<PhraseDatabase>(json, GetJsonOptions());
                            if (loadedDb != null)
                                db = loadedDb;
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"문구 데이터베이스 로드 실패: {ex.Message}");
                    }
                }

                EnsureDefaultPhrase(db);
                return db;
            }
        }

        /// <summary>
        /// 기본 문구(assist 벨 코드)가 없으면 자동으로 복구
        /// 테스트 데이터 자동 정리
        /// </summary>
        private static void EnsureDefaultPhrase(PhraseDatabase db)
        {
            const string defaultBellCode = "crcv.assist";
            const string defaultUid = "90000001";
            
            // 테스트 데이터 정리: "[TEST]"로 시작하는 문구 삭제
            var testPhrases = db.Phrases.Where(p => p.Text != null && p.Text.StartsWith("[TEST]")).ToList();
            bool hasTestData = testPhrases.Count > 0;
            foreach (var testPhrase in testPhrases)
            {
                db.Phrases.Remove(testPhrase);
            }
            
            // uid "90000001"을 가진 문구 찾기
            var phrasesWithDefaultUid = db.Phrases.Where(p => p.Uid == defaultUid).ToList();
            
            // uid "90000001"과 벨 코드 "crcv.assist"를 모두 만족하는 문구 찾기
            var validDefaultPhrase = phrasesWithDefaultUid.FirstOrDefault(p => 
                p.BellCodes != null && 
                p.BellCodes.Any(code => code?.ToLowerInvariant().Trim() == defaultBellCode));
            
            bool needsSave = false;
            
            // uid "90000001"을 가진 문구 중에서 벨 코드가 "crcv.assist"가 아닌 것들 처리
            foreach (var phrase in phrasesWithDefaultUid.ToList())
            {
                bool hasDefaultBellCode = phrase.BellCodes != null && 
                    phrase.BellCodes.Any(code => code?.ToLowerInvariant().Trim() == defaultBellCode);
                
                if (!hasDefaultBellCode)
                {
                    // validDefaultPhrase가 없고 이 문구가 유일한 기본 uid 문구라면 벨 코드 추가
                    if (validDefaultPhrase == null && phrasesWithDefaultUid.Count == 1)
                    {
                        if (phrase.BellCodes == null)
                        {
                            phrase.BellCodes = new List<string>();
                        }
                        // 벨 코드가 이미 있는지 확인 후 추가
                        if (!phrase.BellCodes.Any(code => code?.ToLowerInvariant().Trim() == defaultBellCode))
                        {
                            phrase.BellCodes.Add(defaultBellCode);
                            phrase.UpdatedAt = DateTime.Now;
                            validDefaultPhrase = phrase;
                            needsSave = true;
                        }
                    }
                    else
                    {
                        // 그 외의 경우 삭제
                        db.Phrases.Remove(phrase);
                        needsSave = true;
                    }
                }
            }
            
            // uid "90000001"과 벨 코드 "crcv.assist"를 모두 만족하는 문구가 없으면 생성
            if (validDefaultPhrase == null)
            {
                var defaultPhrase = new PhraseModel
                {
                    Id = 0,
                    Uid = defaultUid,
                    Text = "도와주세요.",
                    IsEnabled = true,
                    Color = "#FF0000",
                    BellCodes = new List<string> { defaultBellCode },
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };
                
                db.Phrases.Insert(0, defaultPhrase);
                needsSave = true;
            }
            else
            {
                // 기본 문구가 맨 앞에 오도록 이동
                if (db.Phrases.IndexOf(validDefaultPhrase) != 0)
                {
                    db.Phrases.Remove(validDefaultPhrase);
                    db.Phrases.Insert(0, validDefaultPhrase);
                    needsSave = true;
                }
            }
            
            // 변경사항이 있으면 저장 (테스트 데이터 삭제 포함)
            if (needsSave || hasTestData)
            {
                SavePhrases(db);
            }
        }


        public static void SavePhrases(PhraseDatabase database)
        {
            lock (_loadLock)
            {
                if (UseMongo(out var conn, out var dbName))
                {
                    try
                    {
                        MongoDatabaseService.SavePhrases(conn, dbName, database);
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"MongoDB 문구 저장 실패: {ex.Message}");
                    }
                    return;
                }
                try
                {
                    string json = JsonSerializer.Serialize(database, GetJsonOptions());
                    
                    // 원자적 파일 쓰기: 임시 파일에 쓰고 교체
                    string tempPath = PhrasesPath + ".tmp";
                    File.WriteAllText(tempPath, json, System.Text.Encoding.UTF8);
                    
                    // 파일이 완전히 쓰여졌는지 확인
                    System.Threading.Thread.Sleep(100);
                    
                    // 원자적 교체 (Windows에서 MoveFile은 원자적)
                    if (File.Exists(PhrasesPath))
                    {
                        File.Replace(tempPath, PhrasesPath, PhrasesPath + ".bak", true);
                    }
                    else
                    {
                        File.Move(tempPath, PhrasesPath);
                    }
                    
                    // 백업 파일 삭제
                    try
                    {
                        if (File.Exists(PhrasesPath + ".bak"))
                        {
                            File.Delete(PhrasesPath + ".bak");
                        }
                    }
                    catch
                    {
                        // 백업 파일 삭제 실패는 무시
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"문구 ?�이???�???�패: {ex.Message}");
                }
            }
        }

        public static SerialSettings LoadSerialSettings()
        {
            if (UseMongo(out var conn, out var dbName))
            {
                try
                {
                    return MongoDatabaseService.LoadSerialSettings(conn, dbName);
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"MongoDB 시리얼 설정 로드 실패: {ex.Message}");
                }
                return new SerialSettings();
            }
            try
            {
                if (File.Exists(SerialSettingsPath))
                {
                    string json = File.ReadAllText(SerialSettingsPath, System.Text.Encoding.UTF8);
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;
                    // 새 형식: { "Ports": [ { "Id", "PortName", ... } ] }
                    if (root.TryGetProperty("Ports", out var portsEl) && portsEl.ValueKind == JsonValueKind.Array)
                    {
                        var list = new List<SerialPortEntry>();
                        foreach (var el in portsEl.EnumerateArray())
                        {
                            var entry = JsonSerializer.Deserialize<SerialPortEntry>(el.GetRawText(), GetJsonOptions());
                            if (entry != null) list.Add(entry);
                        }
                        return new SerialSettings { Ports = list };
                    }
                    // 구 형식: { "PortName", "BaudRate", ... } 단일 포트
                    if (root.TryGetProperty("PortName", out _))
                    {
                        var single = JsonSerializer.Deserialize<SerialPortEntry>(json, GetJsonOptions());
                        if (single != null)
                            return new SerialSettings { Ports = new List<SerialPortEntry> { single } };
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Serial settings load error: {ex.Message}");
            }

            return new SerialSettings();
        }

        public static void SaveSerialSettings(SerialSettings settings)
        {
            if (UseMongo(out var conn, out var dbName))
            {
                try
                {
                    MongoDatabaseService.SaveSerialSettings(conn, dbName, settings);
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"MongoDB 시리얼 설정 저장 실패: {ex.Message}");
                }
                return;
            }
            try
            {
                string json = JsonSerializer.Serialize(settings, GetJsonOptions());
                File.WriteAllText(SerialSettingsPath, json, System.Text.Encoding.UTF8);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Serial settings save error: {ex.Message}");
            }
        }

        public static RemoteControlSettings LoadRemoteControlSettings()
        {
            lock (_loadLock)
            {
                try
                {
                    if (File.Exists(RemoteControlPath))
                    {
                        var json = File.ReadAllText(RemoteControlPath, System.Text.Encoding.UTF8);
                        var loaded = JsonSerializer.Deserialize<RemoteControlSettings>(json, GetJsonOptions());
                        return NormalizeRemoteControl(loaded);
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"리모콘 설정 로드 실패: {ex.Message}");
                }
                return NormalizeRemoteControl(null);
            }
        }

        public static void SaveRemoteControlSettings(RemoteControlSettings? settings)
        {
            lock (_loadLock)
            {
                try
                {
                    var normalized = NormalizeRemoteControl(settings);
                    var json = JsonSerializer.Serialize(normalized, GetJsonOptions());
                    File.WriteAllText(RemoteControlPath, json, System.Text.Encoding.UTF8);
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"리모콘 설정 저장 실패: {ex.Message}");
                }
            }
        }

        private static RemoteControlSettings NormalizeRemoteControl(RemoteControlSettings? input)
        {
            var outCfg = new RemoteControlSettings();
            var map = new Dictionary<int, RemoteControlButton>();
            if (input?.Buttons != null)
            {
                foreach (var b in input.Buttons)
                {
                    if (b == null) continue;
                    if (b.Number < 1 || b.Number > 15) continue;
                    map[b.Number] = new RemoteControlButton
                    {
                        Number = b.Number,
                        Name = b.Name ?? string.Empty,
                        SendCode = b.SendCode ?? string.Empty
                    };
                }
            }
            for (int i = 1; i <= 15; i++)
            {
                if (map.TryGetValue(i, out var b))
                    outCfg.Buttons.Add(b);
                else
                    outCfg.Buttons.Add(new RemoteControlButton { Number = i, Name = string.Empty, SendCode = string.Empty });
            }
            return outCfg;
        }

        /// <summary>로컬에 적용된 setid (COM RX 시 이 설정 기준으로 알림). setid.md 규격.</summary>
        public static string? LoadActiveSetId()
        {
            try
            {
                if (File.Exists(ActiveSetIdPath))
                {
                    var json = File.ReadAllText(ActiveSetIdPath, System.Text.Encoding.UTF8);
                    var obj = JsonSerializer.Deserialize<ActiveSetIdDoc>(json);
                    var s = obj?.ActiveSetId;
                    return string.IsNullOrWhiteSpace(s) ? null : s.Trim();
                }
            }
            catch { }
            return null;
        }

        public static void SaveActiveSetId(string? setid)
        {
            try
            {
                var json = JsonSerializer.Serialize(new ActiveSetIdDoc { ActiveSetId = setid ?? "" }, GetJsonOptions());
                File.WriteAllText(ActiveSetIdPath, json, System.Text.Encoding.UTF8);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"ActiveSetId save error: {ex.Message}");
            }
        }

        private class ActiveSetIdDoc
        {
            [System.Text.Json.Serialization.JsonPropertyName("activeSetId")]
            public string ActiveSetId { get; set; } = "";
        }
    }
}

