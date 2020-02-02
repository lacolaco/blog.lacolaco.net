export interface PaginationParams {
  per_page: number;
  page: number;
}

export interface PaginatedResponse {
  prev_page: number | null;
  next_page: number | null;
  total_count: number;
  page: number;
  per_page: number;
  max_per_page: number;
}

export interface PostsResponse extends PaginatedResponse {
  posts: PostReponse[];
}

export interface PostReponse {
  number: number;
  name: string;
  full_name: string;
  wip: boolean;
  body_md: string;
  body_html: string;
  created_at: string;
  message: string;
  url: string;
  updated_at: string;
  tags: string[];
  category: string;
  revision_number: number;
  created_by: {
    name: string;
    screen_name: string;
    icon: string;
  };
  updated_by: {
    name: string;
    screen_name: string;
    icon: string;
  };
  kind: "flow";
  comments_count: number;
  tasks_count: number;
  done_tasks_count: number;
  stargazers_count: number;
  watchers_count: number;
  star: boolean;
  watch: boolean;
}
