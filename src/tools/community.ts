import { tool } from "@langchain/core/tools";
import { DcInsideApi } from "../containers/dcinside/api";
import { z } from "zod";

const api = new DcInsideApi();

const getDcinsidePosts = tool(async () => {
  const posts = await Promise.all([api.getGalleryList("bitcoins_new1", 1), api.getGalleryList("chartanalysis", 1)]).then(([bitcoins, chartanalysis]) => [...bitcoins, ...chartanalysis]);

  const filteredPosts = posts.sort((a, b) => parseInt(b.hit) - parseInt(a.hit)).slice(0, 25);

  return filteredPosts.map(post => `게시글 제목: ${post.subject} / 조회수: ${post.hit}`).join("\n");
}, {
  name: "get_dcinside_community_posts",
  description: "디시인사이드 가상화폐 게시판 인기 게시글 조회",
});

const searchDcinsidePosts = tool(async ({ keyword }) => {
  const searchResult = await api.searchPosts(keyword);

  return `${keyword}검색 결과:
${searchResult.board.map(post => `제목: ${post.title} / 내용: ${post.content.slice(0, 100)}`).join("\n------\n")}`;
}, {
  name: "search_dcinside_community_posts",
  description: "디시인사이드 커뮤니티 게시글 검색. 코인 이름을 포함해주세요",
  schema: z.object({
    keyword: z.string({ description: "검색어 (한글로)" }),
  }),
});

export const communityTools = [
  getDcinsidePosts,
  searchDcinsidePosts
];
