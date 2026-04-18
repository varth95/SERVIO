/**
 * Servio Notifications Module
 */

// Local escapeHtml in case food.js isn't loaded yet
function _escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const Notifications = {
  async loadAndRender() {
    const res = await Api.notifications.list();
    const container = document.getElementById("notif-list");

    if (!res.ok) {
      container.innerHTML = '<p class="empty-state">Failed to load notifications.</p>';
      return;
    }

    if (!res.data.length) {
      container.innerHTML = '<p class="empty-state">🔔 No notifications yet.</p>';
      return;
    }

    container.innerHTML = "";
    res.data.forEach((n) => {
      const item = document.createElement("div");
      item.className = `notif-item ${n.is_read ? "" : "unread"}`;
      item.dataset.id = n.id;

      const icon = Notifications.getIcon(n.type);
      const time = new Date(n.created_at).toLocaleString();

      item.innerHTML = `
        <div class="notif-icon">${icon}</div>
        <div class="notif-body">
          <div class="notif-msg">${_escapeHtml(n.message)}</div>
          <div class="notif-time">${time}</div>
        </div>
        ${!n.is_read ? '<button class="btn btn-outline btn-sm" style="flex-shrink:0;" onclick="Notifications.markRead(' + n.id + ', this)">Mark read</button>' : ""}
      `;

      container.appendChild(item);
    });
  },

  async markRead(id, btn) {
    const res = await Api.notifications.markRead(id);
    if (res.ok) {
      const item = document.querySelector(`.notif-item[data-id="${id}"]`);
      if (item) {
        item.classList.remove("unread");
        if (btn) btn.remove();
      }
      Notifications.updateBadge();
    }
  },

  async updateBadge() {
    const res = await Api.notifications.unreadCount();
    const badge = document.getElementById("notif-badge");
    if (res.ok) {
      const count = res.data.unread;
      if (count > 0) {
        badge.textContent = count > 99 ? "99+" : count;
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    }
  },

  getIcon(type) {
    const icons = {
      food_posted: "🍱",
      food_claimed: "✅",
      delivery_started: "🚚",
      food_received: "🎉",
      verification_uploaded: "📷",
      decomposition_assigned: "♻️",
      decomposition_collected: "✅",
      general: "🔔",
    };
    return icons[type] || "🔔";
  },
};

function initNotificationsUI() {
  document.getElementById("mark-all-read-btn").addEventListener("click", async () => {
    const res = await Api.notifications.markAllRead();
    if (res.ok) {
      Notifications.loadAndRender();
      Notifications.updateBadge();
      showToast("All notifications marked as read.", "success");
    }
  });
}
