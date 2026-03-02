<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import DatePicker from '$lib/components/DatePicker.svelte';
	import { page } from '$app/state';

	const navItems = [
		{ label: '대시보드', href: '/dashboard' },
		{ label: '데이터 입력', href: '/data-input' },
		{ label: '주문', href: '/order' },
		{ label: '설정', href: '/settings' }
	];

	let { children } = $props();

	const isActive = (href: string) => {
		const path = page.url.pathname;
		return path.startsWith(href);
	};

	const isLogin = () => page.url.pathname === '/login';
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>MTECH</title>
	<meta name="description" content="MTECH" />
</svelte:head>

{#if isLogin()}
	<main class="login-shell">
		{@render children()}
	</main>
{:else}
	<div class="app-shell">
		<aside class="sidebar glass">
			<div class="brand">
				<img src="/company_logo.png" alt="MTECH" class="brand-logo" />
			</div>

			<nav class="nav">
				{#each navItems as item}
					<a href={item.href} class:active={isActive(item.href)}>{item.label}</a>
				{/each}
			</nav>

			<div class="sidebar-footer">
				시스템 동기화 - Postgres / hecon
				<div class="muted" style="margin-top: 6px;">마지막 갱신: 2분 전</div>
			</div>
		</aside>

		<div class="main">
			<header class="topbar glass">
				<div class="topbar-actions">
					<DatePicker />
					<div class="chip">관리자</div>
					<form method="POST" action="/logout">
						<button type="submit" class="topbar-logout">Log out</button>
					</form>
				</div>
			</header>

			<main class="content">
				{@render children()}
			</main>
		</div>
	</div>
{/if}
