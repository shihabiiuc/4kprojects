/** Split text into words for the [data-reveal] word/line animations.
    Only ordinary whitespace separates words; non-breaking spaces stay inside. */
export const words = (text: string) => text.split(/[ \t\r\n]+/).filter(Boolean);
