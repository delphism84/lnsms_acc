using Microsoft.AspNetCore.SignalR;

namespace CareReceiverAgent.Backend.Hubs
{
    /// <summary>
    /// SignalR Hub for real-time notifications
    /// </summary>
    public class NotificationHub : Hub
    {
        public async Task JoinGroup(string groupName)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        }

        public async Task LeaveGroup(string groupName)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        }
    }
}

