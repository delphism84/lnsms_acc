using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CareReceiverAgent.Host.Services
{
    /// <summary>
    /// ?¨Ìä∏ Í¥ÄÎ¶??úÎπÑ??- ?¨Ìä∏ Ï∂©Îèå Í∞êÏ? Î∞??êÎèô ?¨Ìä∏ Î≥ÄÍ≤?
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
        /// ?¨Ïö© Í∞Ä?•Ìïú ?¨Ìä∏ Ï∞æÍ∏∞
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
            
            // Í∏∞Î≥∏ Î≤îÏúÑ?êÏÑú Ï∞æÏ? Î™ªÌïòÎ©??úÏä§?úÏù¥ ?†Îãπ
            return 0; // 0??Î∞òÌôò?òÎ©¥ ?úÏä§?úÏù¥ ?êÎèô ?†Îãπ
        }

        /// <summary>
        /// ?¨Ìä∏Í∞Ä ?¨Ïö© Í∞Ä?•ÌïúÏßÄ ?ïÏù∏
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
        /// ?§Ï†ï ?åÏùº?êÏÑú ?¨Ìä∏ ?ΩÍ∏∞
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
                System.Diagnostics.Debug.WriteLine($"?§Ï†ï ?åÏùº Î°úÎìú ?§Ìå®: {ex.Message}");
            }

            return new AppSettings();
        }

        /// <summary>
        /// ?§Ï†ï ?åÏùº???¨Ìä∏ ?Ä??
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
                System.Diagnostics.Debug.WriteLine($"?¨Ìä∏ ?§Ï†ï ?Ä?? {port}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"?§Ï†ï ?åÏùº ?Ä???§Ìå®: {ex.Message}");
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

