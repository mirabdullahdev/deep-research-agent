from langgraph.graph import END, START, StateGraph

from app.agents.nodes import State, after_reflect, fan_out, plan, reflect, research, write


def route_start(state: State):
    return fan_out(state) if state["searches"] else "plan"


def build_graph():
    g = StateGraph(State)
    g.add_node("plan", plan)
    g.add_node("research", research)
    g.add_node("reflect", reflect)
    g.add_node("write", write)

    g.add_conditional_edges(START, route_start, ["plan", "research"])
    g.add_conditional_edges("plan", fan_out, ["research"])
    g.add_edge("research", "reflect")
    g.add_conditional_edges("reflect", after_reflect, ["research", "write"])
    g.add_edge("write", END)
    return g.compile()
