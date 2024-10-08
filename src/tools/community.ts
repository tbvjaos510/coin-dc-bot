import { tool } from "@langchain/core/tools";
import { DcInsideApi } from "../containers/dcinside/api";
import { z } from "zod";
import { CoinPanAPI } from "../containers/coinpan/api";

const dcApi = new DcInsideApi();
const coinpanAPi = new CoinPanAPI();

const getCoinpanPosts = tool(async () => {
  const posts = await coinpanAPi.getFreeBoardPopularList();

  return posts.map(post => `코인판 커뮤니티 실시간 인기 게시글
-----
게시글 제목: ${post.title} / 조회수: ${post.hit}`).join("\n");
}, {
  name: "get_coinpan_posts",
  description: "코인판 실시간 인기 게시글 조회",
});

const getDcinsidePosts = tool(async () => {
  const posts = await dcApi.getPopularGalleryList();
  return posts.map(post => `디씨인사이드 게시글
-----
게시글 제목: ${post.subject} / 조회수: ${post.hit}`).join("\n");
}, {
  name: "get_dcinside_community_posts",
  description: "디시인사이드 가상화폐 게시판 실시간 인기 게시글 조회",
});

const searchDcinsidePosts = tool(async ({ keyword }) => {
  const searchResult = await dcApi.searchPosts(keyword);

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
  getCoinpanPosts,
  getDcinsidePosts,
  searchDcinsidePosts,
];
