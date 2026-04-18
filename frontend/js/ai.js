/**
 * Servio AI Assistant Module
 */

const AI = {
  init() {
    const fab = document.getElementById("ai-fab");
    const panel = document.getElementById("ai-panel");
    const closeBtn = document.getElementById("ai-close");
    const sendBtn = document.getElementById("ai-send-btn");
    const input = document.getElementById("ai-input");

    fab.addEventListener("click", () => {
      panel.classList.toggle("hidden");
      if (!panel.classList.contains("hidden")) {
        input.focus();
      }
    });

    closeBtn.addEventListener("click", () => {
      panel.classList.add("hidden");
    });

    sendBtn.addEventListener("click", () => AI.sendMessage());

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") AI.sendMessage();
    });
  },

  async sendMessage() {
    const input = document.getElementById("ai-input");
    const query = input.value.trim();
    if (!query) return;

    AI.appendMessage(query, "user");
    input.value = "";

    const typingEl = AI.appendMessage("Thinking...", "bot");

    const res = await Api.ai.suggest(query);

    typingEl.remove();

    if (res.ok) {
      AI.appendMessage(res.data.response, "bot");
    } else {
      AI.appendMessage("Sorry, I couldn't process that. Please try again.", "bot");
    }
  },

  appendMessage(text, type) {
    const messages = document.getElementById("ai-messages");
    const msg = document.createElement("div");
    msg.className = `ai-msg ai-msg-${type}`;
    msg.textContent = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  },
};
