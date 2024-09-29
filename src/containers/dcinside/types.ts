export interface Gallery {
  no: string;
  headnum: string;
  hit: string;
  recommend: string;
  total_comment: string;
  user_id: string;
  ip: string;
  subject: string;
  name: string;
  date_time: string;
}

export interface SearchResult {
  board: {
    id: string;
    title: string;
    content: string;
    gall_name: string
  }[]
}
