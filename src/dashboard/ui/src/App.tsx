import { Route } from "@solidjs/router";
import type { Component } from "solid-js";
import SwarmListRoute from "./routes/index.js";
import SwarmDetailRoute from "./routes/swarm-detail.js";

const App: Component = () => {
	return (
		<>
			<Route path="/" component={SwarmListRoute} />
			<Route path="/swarm/:id" component={SwarmDetailRoute} />
		</>
	);
};

export default App;
