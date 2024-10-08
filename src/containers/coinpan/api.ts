import parse from "node-html-parser";

interface Board {
  title: string;
  date: string;
  hit: number;
}

export class CoinPanAPI {
  async getFreeBoardPopularList() {
    const boards = await Promise.all([1, 2].map(page => this.getFreeBoardList(page))).then(boards => boards.flat());

    return boards.sort((a, b) => b.hit - a.hit).slice(0, 30);
  }

  async getFreeBoardList(page: number) {
    const response = await fetch(`https://coinpan.com/index.php?mid=free&page=${page}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();

    const root = parse(html);

    const list = root.querySelectorAll(".m-list > *:nth-child(2) .list-element");

    const boards: Board[] = list.map(element => {
      const title = element.querySelector(".title")?.innerText?.replace(/^[\n\t]+/, '')?.trim() ?? "";
      const date = element.querySelector(".date")?.innerText ?? "";
      const hit = Number(element.querySelector(".hit")?.innerText?.split(" ").pop() ?? 0);

      return {
        title,
        date,
        hit,
      };
    });

    return boards;
  }
}
