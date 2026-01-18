import { createRootRoute, Outlet, ScrollRestoration } from "@tanstack/react-router";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider";
import "fumadocs-ui/style.css";
import "../index.css";
import { source } from "@/lib/source";

export const Route = createRootRoute({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: "Documentation",
			},
			{
				name: "description",
				content: "Starter template documentation",
			},
		],
		links: [{ rel: "icon", href: "/favicon.ico" }],
	}),
});

function RootComponent() {
	return (
		<RootProvider>
			<DocsLayout
				tree={source.pageTree}
				nav={{
					title: "Docs",
				}}
			>
				<ScrollRestoration />
				<Outlet />
			</DocsLayout>
		</RootProvider>
	);
}
