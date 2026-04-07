using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
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
        private static string NetworkTransportPath => Path.Combine(DataDir, "network_transport.json");
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
            
            // uid "90000001" + crcv.assist = 목록 1번(기본) 문구 필백 — 장애인 assist·테스트 벨 코드와 동일 소스
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
                        using var doc = JsonDocument.Parse(json);
                        var root = doc.RootElement;
                        if (root.TryGetProperty("remotes", out var remEl) && remEl.ValueKind == JsonValueKind.Array)
                        {
                            var list = JsonSerializer.Deserialize<List<RemoteControlEntry>>(remEl.GetRawText(), GetJsonOptions()) ?? new List<RemoteControlEntry>();
                            return NormalizeRemoteControl(new RemoteControlSettings { Remotes = list });
                        }
                        if (root.TryGetProperty("buttons", out var btnEl) && btnEl.ValueKind == JsonValueKind.Array)
                        {
                            var legacy = JsonSerializer.Deserialize<List<LegacyRemoteButtonDto>>(btnEl.GetRawText(), GetJsonOptions());
                            return MigrateLegacyRemoteButtons(legacy);
                        }
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"리모콘 설정 로드 실패: {ex.Message}");
                }
                return NormalizeRemoteControl(null);
            }
        }

        private sealed class LegacyRemoteButtonDto
        {
            public int Number { get; set; }
            public string? Name { get; set; }
            public string? SendCode { get; set; }
        }

        private static RemoteControlSettings MigrateLegacyRemoteButtons(List<LegacyRemoteButtonDto>? legacy)
        {
            var outCfg = new RemoteControlSettings();
            if (legacy == null) return outCfg;
            foreach (var b in legacy)
            {
                if (b == null) continue;
                var name = (b.Name ?? "").Trim();
                var send = (b.SendCode ?? "").Trim();
                if (string.IsNullOrEmpty(name) && string.IsNullOrEmpty(send)) continue;
                outCfg.Remotes.Add(new RemoteControlEntry
                {
                    Id = Guid.NewGuid().ToString("N"),
                    Name = string.IsNullOrEmpty(name) ? $"리모콘 {b.Number}" : name,
                    BellCode = "",
                    Enabled = true
                });
            }
            return NormalizeRemoteControl(outCfg);
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
            if (input?.Remotes == null) return outCfg;
            foreach (var e in input.Remotes)
            {
                if (e == null) continue;
                var id = string.IsNullOrWhiteSpace(e.Id) ? Guid.NewGuid().ToString("N") : e.Id.Trim();
                var name = e.Name ?? "";
                var code = (e.BellCode ?? "").Trim().ToLowerInvariant();
                outCfg.Remotes.Add(new RemoteControlEntry
                {
                    Id = id,
                    Name = name,
                    BellCode = code,
                    Enabled = e.Enabled
                });
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

        /// <summary>TCP/UDP 수신 링크 설정 (로컬 JSON).</summary>
        public static NetworkTransportSettings LoadNetworkTransportSettings()
        {
            lock (_loadLock)
            {
                try
                {
                    if (File.Exists(NetworkTransportPath))
                    {
                        var json = File.ReadAllText(NetworkTransportPath, System.Text.Encoding.UTF8);
                        var s = JsonSerializer.Deserialize<NetworkTransportSettings>(json, GetJsonOptions());
                        return NormalizeNetworkTransport(s);
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"network transport load: {ex.Message}");
                }
                return new NetworkTransportSettings();
            }
        }

        public static void SaveNetworkTransportSettings(NetworkTransportSettings? settings)
        {
            lock (_loadLock)
            {
                try
                {
                    var normalized = NormalizeNetworkTransport(settings);
                    var json = JsonSerializer.Serialize(normalized, GetJsonOptions());
                    File.WriteAllText(NetworkTransportPath, json, System.Text.Encoding.UTF8);
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"network transport save: {ex.Message}");
                }
            }
        }

        private static NetworkTransportSettings NormalizeNetworkTransport(NetworkTransportSettings? input)
        {
            var o = new NetworkTransportSettings();
            if (input?.Links == null) return o;
            foreach (var e in input.Links)
            {
                if (e == null) continue;
                var id = string.IsNullOrWhiteSpace(e.Id) ? Guid.NewGuid().ToString("N") : e.Id.Trim();
                var proto = (e.Protocol ?? "tcp").Trim().ToLowerInvariant();
                if (proto != "udp") proto = "tcp";
                var host = (e.Host ?? "").Trim();
                if (string.IsNullOrEmpty(host)) host = "127.0.0.1";
                var port = e.Port < 0 || e.Port > 65535 ? 0 : e.Port;
                o.Links.Add(new NetworkTransportEntry
                {
                    Id = id,
                    Name = e.Name ?? "",
                    Protocol = proto,
                    Host = host,
                    Port = port,
                    Enabled = e.Enabled,
                    AutoConnect = e.AutoConnect
                });
            }
            return o;
        }
    }
}

