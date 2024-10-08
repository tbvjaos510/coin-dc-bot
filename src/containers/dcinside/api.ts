import AppIdGenerator from "./auth";
import { Gallery, SearchResult } from "./types";

export class DcInsideApi {
  private appIdGenerator: AppIdGenerator = new AppIdGenerator();

  public async getPopularGalleryList(): Promise<Gallery[]> {
    const posts = await Promise.all([this.getGalleryList("bitcoins_new1", 1), this.getGalleryList("bitcoins_new1", 2), this.getGalleryList("chartanalysis", 1), this.getGalleryList("chartanalysis", 2)]).then(boards => boards.flat());

    const filteredPosts = posts.sort((a, b) => parseInt(b.hit) - parseInt(a.hit)).slice(0, 40);

    return filteredPosts;
  }

  public async getGalleryList(id: string, page: number): Promise<Gallery[]> {
    const appId = await this.appIdGenerator.getAppId();

    const response = await this.requestWithRedirect(`https://app.dcinside.com/api/gall_list_new.php?id=${id}&page=${page}&app_id=${appId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return data[0].gall_list;
  }

  public async getGalleryDetail(id: string, no: string): Promise<Gallery> {
    const appId = await this.appIdGenerator.getAppId();

    const response = await this.requestWithRedirect(`https://app.dcinside.com/api/gall_view_new.php?id=${id}&no=${no}&app_id=${appId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return data[0];
  }

  public async searchPosts(keyword: string): Promise<SearchResult> {
    const appId = await this.appIdGenerator.getAppId();

    const formData = new FormData();

    formData.append("app_id", appId);
    formData.append("search_type", "search_main");
    formData.append("keyword", keyword);

    const response = await fetch("http://app.dcinside.com/api/_total_search.php", {
      method: "POST",
      body: formData,
      headers: {
        "User-Agent": "dcinside.app",
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return data;
  }



  private async requestWithRedirect(url: string, init?: RequestInit): Promise<Response> {
    const base64Url = Buffer.from(url).toString("base64");

    const response = await fetch(`https://app.dcinside.com/api/redirect.php?hash=${base64Url}`, { redirect: "manual" });

    if (response.status !== 302) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const nextUrl = response.headers.get("location") as string;

    if (!nextUrl) {
      throw new Error("Redirect failed");
    }

    return fetch(nextUrl, {
      ...init,
      headers: {
        ...init?.headers,
        "User-Agent": "dcinside.app",
      },
    });
  }
}
