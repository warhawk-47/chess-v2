# ChessEdge

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/IshigamiSenku123/generated-app-20251008-12563)

ChessEdge is a sophisticated, visually stunning online multiplayer chess application built to run entirely on Cloudflare's edge network. The platform offers multiple game modes: a challenging single-player experience against an AI, a seamless random matchmaking system for competitive play, and private lobbies for playing with friends. The core of the application is powered by Cloudflare Durable Objects to manage player profiles, individual game states, and the matchmaking queue, ensuring scalability and low latency. Player profiles track career statistics like wins, losses, and total games played. During matches, players can communicate through an integrated real-time chat. The frontend is a masterpiece of modern UI/UX design, featuring a clean, intuitive interface, smooth animations, and a beautiful, high-contrast design that makes playing a delight.

## Key Features

-   **Multiple Game Modes**: Play against a local AI, find a random opponent online, or create a private game to play with a friend.
-   **Real-Time Multiplayer**: Experience seamless, low-latency gameplay powered by Cloudflare Workers.
-   **Player Profiles & Statistics**: Track your career progress with detailed stats on wins, losses, and total games played.
-   **Scalable Architecture**: Built on Cloudflare Durable Objects to handle game state, matchmaking, and player data efficiently.
-   **Modern UI/UX**: A beautiful, responsive, and intuitive interface designed for an exceptional user experience.
-   **In-Game Chat**: Communicate with your opponent in real-time during matches.

## Technology Stack

-   **Frontend**:
    -   React & Vite
    -   TypeScript
    -   Tailwind CSS & shadcn/ui
    -   Zustand for state management
    -   Framer Motion for animations
    -   `chess.js` for game logic
    -   `react-chessboard` for the interactive board
-   **Backend**:
    -   Cloudflare Workers
    -   Hono web framework
    -   Cloudflare Durable Objects for stateful coordination

## Getting Started

Follow these instructions to get the project up and running on your local machine for development and testing purposes.

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or later)
-   [Bun](https://bun.sh/) package manager
-   [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) logged into your Cloudflare account.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/chess-edge.git
    cd chess-edge
    ```

2.  **Install dependencies:**
    This project uses Bun for package management.
    ```bash
    bun install
    ```

### Running in Development Mode

To start the development server for both the frontend and the backend worker, run:

```bash
bun run dev
```

This command will:
-   Start the Vite development server for the React frontend, typically on `http://localhost:3000`.
-   Start the Wrangler development server for the Hono backend worker.
-   Proxy API requests from `/api/*` to the local worker instance.

You can now open your browser and navigate to `http://localhost:3000` to see the application.

## Project Structure

-   `src/`: Contains the frontend React application source code.
    -   `pages/`: Top-level page components.
    -   `components/`: Reusable React components.
    -   `lib/`: Utility functions and libraries.
-   `worker/`: Contains the backend Cloudflare Worker source code.
    -   `index.ts`: The main entry point for the worker.
    -   `user-routes.ts`: Hono route definitions.
    -   `entities.ts`: Durable Object entity definitions.
-   `shared/`: Contains TypeScript types and constants shared between the frontend and backend.

## Deployment

This project is designed for easy deployment to the Cloudflare network.

### Manual Deployment

1.  **Build the project:**
    This command bundles the frontend and worker code for production.
    ```bash
    bun run build
    ```

2.  **Deploy to Cloudflare:**
    This command publishes your application to your Cloudflare account.
    ```bash
    bun run deploy
    ```

### One-Click Deployment

You can also deploy this project to Cloudflare with a single click.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/IshigamiSenku123/generated-app-20251008-12563)