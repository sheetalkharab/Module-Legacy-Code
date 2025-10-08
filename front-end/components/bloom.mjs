import { apiService } from "../lib/api.mjs";
/**
 * Create a bloom component
 * @param {string} template - The ID of the template to clone
 * @param {Object} bloom - The bloom data
 * @returns {DocumentFragment} - The bloom fragment of UI, for items in the Timeline
 * btw a bloom object is composed thus
 * {"id": Number,
 * "sender": username,
 * "content": "string from textarea",
 * "sent_timestamp": "datetime as ISO 8601 formatted string"}

 */
const createBloom = (template, bloom) => {
  if (!bloom) return;
  const bloomFrag = document.getElementById(template).content.cloneNode(true);
  const bloomParser = new DOMParser();

  const bloomArticle = bloomFrag.querySelector("[data-bloom]");
  const bloomUsername = bloomFrag.querySelector("[data-username]");
  const bloomTime = bloomFrag.querySelector("[data-time]");
  const bloomTimeLink = bloomFrag.querySelector("a:has(> [data-time])");
  const bloomContent = bloomFrag.querySelector("[data-content]");

  bloomArticle.setAttribute("data-bloom-id", bloom.id);
  bloomUsername.setAttribute("href", `/profile/${bloom.sender}`);
  bloomUsername.textContent = bloom.sender;
  bloomTime.textContent = _formatTimestamp(bloom.sent_timestamp);
  bloomTimeLink.setAttribute("href", `/bloom/${bloom.id}`);

  if (bloom.type === "rebloom" && bloom.original_bloom_id) {
    if (!window._bloomCache) window._bloomCache = {};

    const cached = window._bloomCache[bloom.original_bloom_id];
    if (cached) {
      bloomContent.innerHTML = `
       Reblooomed <strong>@${cached.sender}</strong><br>
      <em>${cached.content}</em>
    `;
    } else {
      apiService
        .getBloom(bloom.original_bloom_id)
        .then((original) => {
          window._bloomCache[bloom.original_bloom_id] = original;
          bloomContent.innerHTML = `
           Reblooomed <strong>@${original.sender}</strong><br>
          <em>${original.content}</em>
        `;
        })
        .catch(() => {
          bloomContent.textContent = " Rebloom (original not found)";
        });
    }
  } else {
    bloomContent.replaceChildren(
      ...bloomParser.parseFromString(
        _formatHashtags(bloom.content),
        "text/html"
      ).body.childNodes
    );
  }

  // --- Add a Rebloom button ---
  const rebloomButton = document.createElement("button");
  rebloomButton.textContent = " Rebloom";
  rebloomButton.classList.add("rebloom-button");
  rebloomButton.addEventListener("click", async () => {
    try {
      rebloomButton.disabled = true;
      rebloomButton.textContent = "Reblooming...";
      const result = await apiService.rebloomBloom(bloom.id);

      if (result.success) {
        rebloomButton.textContent = "Rebloomed!";
      } else {
        alert("Rebloom failed");
        rebloomButton.textContent = " Rebloom";
      }
    } catch (err) {
      console.error(err);
      alert("Failed to rebloom.");
      rebloomButton.textContent = " Rebloom";
    } finally {
      rebloomButton.disabled = false;
    }
  });

  // Add the button to the bloom card (e.g., at the bottom)
  bloomArticle.appendChild(rebloomButton);

  return bloomFrag;
};

function _formatHashtags(text) {
  if (!text) return text;
  return text.replace(
    /\B#[^#]+/g,
    (match) => `<a href="/hashtag/${match.slice(1)}">${match}</a>`
  );
}

function _formatTimestamp(timestamp) {
  if (!timestamp) return "";

  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);

    // Less than a minute
    if (diffSeconds < 60) {
      return `${diffSeconds}s`;
    }

    // Less than an hour
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    }

    // Less than a day
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h`;
    }

    // Less than a week
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return `${diffDays}d`;
    }

    // Format as month and day for older dates
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  } catch (error) {
    console.error("Failed to format timestamp:", error);
    return "";
  }
}

export {createBloom};
