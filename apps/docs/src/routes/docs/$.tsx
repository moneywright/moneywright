import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsBody, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { source } from "@/lib/source";
import type { ReactNode } from "react";

export const Route = createFileRoute("/docs/$")({
	component: DocsPageComponent,
	loader: async ({ params }) => {
		const slug = params["_splat"];
		const slugArray = slug ? slug.split("/") : [];
		const page = source.getPage(slugArray);

		if (!page) {
			throw notFound();
		}

		return { page };
	},
	head: ({ loaderData }) => {
		const title = loaderData?.page?.data.title || "Documentation";
		const description = loaderData?.page?.data.description || "";

		return {
			meta: [
				{ title: `${title} | Docs` },
				{ name: "description", content: description },
			],
		};
	},
});

function DocsPageComponent() {
	const { page } = Route.useLoaderData();

	const MDXContent = page.data.body as unknown as (props: {
		components?: Record<string, React.ComponentType>;
	}) => ReactNode;

	return (
		<DocsPage toc={page.data.toc}>
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsBody>
				<MDXContent />
			</DocsBody>
		</DocsPage>
	);
}
