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
      container.innerHTML = '<div class="empty-state"><span class="empty-state-icon" data-icon="bell-off"></span><span>Failed to load notifications.</span></div>';
      Icons.attach();
      return;
    }

    if (!res.data.length) {
      container.innerHTML = '<div class="empty-state"><span class="empty-state-icon" data-icon="bell-off"></span><span>No notifications yet.</span></div>';
      Icons.attach();
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
        <div class="notif-icon"><span class="notif-icon-inner" data-icon="${icon}"></span></div>
        <div class="notif-body">
          <div class="notif-msg">${_escapeHtml(n.message)}</div>
          <div class="notif-time">${time}</div>
        </div>
        ${!n.is_read ? '<button class="btn btn-outline btn-sm" style="flex-shrink:0; display: inline-flex; align-items: center; gap: 6px;" onclick="Notifications.markRead(' + n.id + ', this)"><span class="btn-icon btn-icon-left" data-icon="check"></span> Mark read</button>' : ""}
      `;

      container.appendChild(item);
    });

    Icons.attach();
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
      food_posted: "package",
      food_claimed: "check",
      delivery_started: "truck",
      food_received: "users",
      verification_uploaded: "camera",
      general: "bell",
    };
    return icons[type] || "bell";
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
