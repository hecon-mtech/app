<script lang="ts">
	import { Markdown } from 'carta-md';
	import 'carta-md/default.css';
	import { chatMarkdownCarta } from '$lib/markdown/carta';

	export let value = '';
	export let theme = 'default';

	// CommonMark closing-delimiter rule: ** preceded by punctuation and followed by a
	// non-punctuation, non-whitespace character is NOT right-flanking, so remark renders
	// it as literal text. This is a known issue with CJK text (e.g. **(일요일)**입니다).
	// Fix: insert U+200B (zero-width space) between closing punctuation and **, making
	// the delimiter no longer "preceded by punctuation" per CommonMark's definition.
	const preprocessMarkdown = (text: string) =>
		text.replace(/([\)\]\}\>\"\'\`])\*\*/g, '$1\u200B**');

	$: processed = preprocessMarkdown(value);
</script>

<div class="markdown-message">
	<Markdown carta={chatMarkdownCarta} {theme} value={processed} />
</div>
