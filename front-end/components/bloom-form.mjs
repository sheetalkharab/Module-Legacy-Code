import {apiService} from "../index.mjs";

/**
 * Create a bloom form component
 * @param {string} template - The ID of the template to clone
 * @param {Object} isLoggedIn - only logged in users see the bloom form
 * @returns {DocumentFragment} - The bloom form fragment
 */
function createBloomForm(template, isLoggedIn) {
  if (!isLoggedIn) return;
  const bloomFormElement = document
    .getElementById(template)
    .content.cloneNode(true);

  return bloomFormElement;
}

/**
 * Handle bloom form submission
 * @param {Event} event - The form submission event
 */
async function handleBloomSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const submitButton = form.querySelector("[data-submit]");
  const originalText = submitButton.textContent;
  const textarea = form.querySelector("textarea");
  const content = textarea.value.trim();

  try {
    // Make form inert while we call the back end
    form.inert = true;
    submitButton.textContent = "Posting...";
    await apiService.postBloom(content);
    textarea.value = "";
  } catch (error) {
    throw error;
  } finally {
    // Restore form
    submitButton.textContent = originalText;
    form.inert = false;
  }
}

/**
 * Handle textarea input for bloom form
 * @param {Event} event - The input event from textarea drives the character counter
 */
function handleTyping(event) {
  const textarea = event.target;
  const counter = textarea
    .closest("[data-form]")
    ?.querySelector("[data-counter]");
  const maxLength = parseInt(textarea.getAttribute("maxlength"), 10);
  counter.textContent = `${textarea.value.length} / ${maxLength}`;
}

export {createBloomForm, handleBloomSubmit, handleTyping};
