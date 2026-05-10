/**
 * Re-export native clipboard utilities from @gwd/native.
 *
 * This module exists for backward compatibility. Prefer importing
 * directly from "@gwd/native/clipboard" in new code.
 */
export {
	copyToClipboard,
	readTextFromClipboard,
	readImageFromClipboard,
} from "@gwd/native/clipboard";
