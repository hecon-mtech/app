import { Carta } from 'carta-md';
import DOMPurify from 'isomorphic-dompurify';

export const chatMarkdownCarta = new Carta({
	sanitizer: (html) => DOMPurify.sanitize(html)
});
