using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CareReceiverAgent.Backend.Services
{
    /// <summary>
    /// 포트 관리 서비스 - 포트 충돌 감지 및 자동 포트 변경
    /// </summary>
    public class PortService
    {
        private static string SettingsPath => Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "settings.json");
        private const int DefaultPort = 58000;
        private const int MinPort = 58000;
        private const int MaxPort = 58999;

        public class AppSettings
        {
            public int Port { get; set; } = DefaultPort;
            public string BackendUrl { get; set; } = $"http://localhost:{DefaultPort}";
        }

        /// <summary>
        /// 사용 가능한 포트 찾기
        /// </summary>
        public static int FindAvailablePort(int startPort = MinPort)
        {
            for (int port = startPort; port <= MaxPort; port++)
            {
                if (IsPortAvailable(port))
                {
                    return port;
                }
            }
            
            // 기본 범위에서 찾지 못하면 시스템이 할당
            return 0; // 0을 반환하면 시스템이 자동 할당
        }

        /// <summary>
        /// 포트가 사용 가능한지 확인
        /// </summary>
        public static bool IsPortAvailable(int port)
        {
            try
            {
                var listener = new TcpListener(IPAddress.Loopback, port);
                listener.Start();
                listener.Stop();
                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// 설정 파일에서 포트 읽기
        /// </summary>
        public static AppSettings LoadSettings()
        {
            try
            {
                if (File.Exists(SettingsPath))
                {
                    string json = File.ReadAllText(SettingsPath, System.Text.Encoding.UTF8);
                    var settings = JsonSerializer.Deserialize<AppSettings>(json, GetJsonOptions());
                    if (settings != null)
                    {
                        return settings;
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"설정 파일 로드 실패: {ex.Message}");
            }

            return new AppSettings();
        }

        /// <summary>
        /// 설정 파일에 포트 저장
        /// </summary>
        public static void SaveSettings(int port)
        {
            try
            {
                var settings = new AppSettings
                {
                    Port = port,
                    BackendUrl = $"http://localhost:{port}"
                };

                string json = JsonSerializer.Serialize(settings, GetJsonOptions());
                File.WriteAllText(SettingsPath, json, System.Text.Encoding.UTF8);
                System.Diagnostics.Debug.WriteLine($"포트 설정 저장: {port}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"설정 파일 저장 실패: {ex.Message}");
            }
        }

        private static JsonSerializerOptions GetJsonOptions()
        {
            return new JsonSerializerOptions
            {
                WriteIndented = true,
                Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
            };
        }
    }
}

