using System.Collections.Generic;

namespace CareReceiverAgent.Host.Models
{
    public class NetworkTransportEntry
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        /// <summary>tcp | udp</summary>
        public string Protocol { get; set; } = "tcp";
        public string Host { get; set; } = "127.0.0.1";
        public int Port { get; set; }
        public bool Enabled { get; set; } = true;
        public bool AutoConnect { get; set; } = true;
    }

    public class NetworkTransportSettings
    {
        public List<NetworkTransportEntry> Links { get; set; } = new();
    }
}
