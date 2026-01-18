import { createAPIFileRoute } from "@tanstack/react-start/api";
import { createSearchAPI } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

const search = createSearchAPI("advanced", {
	indexes: source.getPages().map((page) => ({
		title: page.data.title,
		description: page.data.description,
		url: page.url,
		id: page.url,
		structuredData: page.data.structuredData,
	})),
});

export const APIRoute = createAPIFileRoute("/api/search")({
	GET: async ({ request }) => {
		const url = new URL(request.url);
		const query = url.searchParams.get("query") ?? "";

		const results = search(query);
		return Response.json(results);
	},
});
