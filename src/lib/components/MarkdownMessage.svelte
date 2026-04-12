<script lang="ts">
	import { Markdown } from 'carta-md';
	import 'carta-md/default.css';
	import { chatMarkdownCarta } from '$lib/markdown/carta';

	export let value = '';
	export let theme = 'default';
</script>

<div class="markdown-message">
	<Markdown carta={chatMarkdownCarta} {theme} value={value} />
</div>
