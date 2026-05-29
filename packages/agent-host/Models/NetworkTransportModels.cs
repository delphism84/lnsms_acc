using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace CareReceiverAgent.Host.Models
{
    public class NetworkTransportEntry
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = "";
        [JsonPropertyName("name")]
        public string Name { get; set; } = "";
        /// <summary>tcp | udp</summary>
        [JsonPropertyName("protocol")]
        public string Protocol { get; set; } = "tcp";
        [JsonPropertyName("host")]
        public string Host { get; set; } = "127.0.0.1";
        [JsonPropertyName("port")]
        public int Port { get; set; }
        [JsonPropertyName("enabled")]
        public bool Enabled { get; set; } = true;
        [JsonPropertyName("autoConnect")]
        public bool AutoConnect { get; set; } = true;
    }

    public class NetworkTransportSettings
    {
        [JsonPropertyName("links")]
        public List<NetworkTransportEntry> Links { get; set; } = new();
    }
}
