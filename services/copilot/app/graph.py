"""LangGraph agent: agent -> tools -> agent ... until the model answers without calling a tool."""

from typing import Literal

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import BaseTool
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from .schemas import Turn
from .tools import tool_error_message

BUDGET_NOTE = "Tool budget for this message is used up. Answer the customer now with what you already know."


def tool_rounds(messages: list[BaseMessage]) -> int:
    """Model turns that called tools since the customer's latest message."""
    rounds = 0
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            break
        if isinstance(m, AIMessage) and m.tool_calls:
            rounds += 1
    return rounds


def build_graph(model: BaseChatModel, tools: list[BaseTool], max_tool_rounds: int):
    bound = model.bind_tools(tools)

    async def agent(state: MessagesState):
        return {"messages": [await bound.ainvoke(state["messages"])]}

    # Bedrock rejects a conversation with tool calls unless tools stay configured, so instead of
    # dropping the tools, extra calls are answered with a note that makes the model wrap up.
    async def budget(state: MessagesState):
        last = state["messages"][-1]
        assert isinstance(last, AIMessage)
        return {"messages": [ToolMessage(content=BUDGET_NOTE, tool_call_id=c["id"], name=c["name"]) for c in last.tool_calls]}

    def route(state: MessagesState) -> Literal["tools", "budget", "__end__"]:
        last = state["messages"][-1]
        if not isinstance(last, AIMessage) or not last.tool_calls:
            return END
        rounds = tool_rounds(state["messages"])
        if rounds <= max_tool_rounds:
            return "tools"
        # One budget round lets the model answer; a model that still insists on tools is cut off.
        return "budget" if rounds == max_tool_rounds + 1 else END

    graph = StateGraph(MessagesState)
    graph.add_node("agent", agent)
    graph.add_node("tools", ToolNode(tools, handle_tool_errors=tool_error_message))
    graph.add_node("budget", budget)
    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", route, ["tools", "budget", END])
    graph.add_edge("tools", "agent")
    graph.add_edge("budget", "agent")
    return graph.compile()


def build_messages(system: str, history: list[Turn], message: str) -> list[BaseMessage]:
    """Bedrock needs strictly alternating turns that start with the user, so history is normalised."""
    turns: list[Turn] = []
    for t in history:
        text = t.text.strip()
        if not text:
            continue
        if not turns and t.role == "assistant":
            continue
        if turns and turns[-1].role == t.role:
            turns[-1] = Turn(role=t.role, text=f"{turns[-1].text}\n\n{text}"[:4000])
        else:
            turns.append(Turn(role=t.role, text=text))
    if turns and turns[-1].role == "user":
        turns.pop()
    out: list[BaseMessage] = [SystemMessage(content=system)]
    for t in turns:
        out.append(HumanMessage(content=t.text) if t.role == "user" else AIMessage(content=t.text))
    out.append(HumanMessage(content=message))
    return out
