import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Square,
  Plus,
  Trash2,
  Edit2,
  Check,
  Copy,
  RotateCcw,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  FolderGit2,
  GitPullRequest,
  ShieldAlert,
  Code2,
  ExternalLink,
  Key,
  X,
  HelpCircle,
} from 'lucide-react';
import {
  AssistantConversation,
  AssistantMessage,
  AssistantProviderStatus,
  AssistantContextType,
  RepositoryItem,
  PullRequestItem,
  Finding,
} from '../types';
import {
  fetchAssistantProviderStatus,
  configureAssistantProvider,
  fetchAssistantConversations,
  createAssistantConversation,
  fetchAssistantConversation,
  updateAssistantConversation,
  deleteAssistantConversation,
  streamAssistantChat,
  streamAssistantRegenerate,
  fetchAssistantContextRepositories,
  fetchAssistantContextPullRequests,
  fetchAssistantContextFindings,
} from '../services/api';

interface AIAssistantPageProps {
  repositories: RepositoryItem[];
  selectedRepo: RepositoryItem | null;
  onSelectRepo: (repo: RepositoryItem) => void;
  pullRequests: PullRequestItem[];
  currentAnalysis: any | null;
  selectedFinding: Finding | null;
  onSelectFinding: (finding: Finding | null) => void;
}

// Markdown CodeBlock component with copy-to-clipboard
const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-[#252932] bg-[#0B0D12] font-mono text-xs">
      <div className="px-3 py-1.5 bg-[#151820] border-b border-[#252932] flex items-center justify-between text-[#8E95A2]">
        <span className="text-[11px] font-semibold tracking-wide uppercase text-[#A37BFF]">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] hover:text-[#F5F6F8] hover:bg-[#1C2028] transition-colors"
          title="Copy code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[#DCE0E8] leading-relaxed whitespace-pre font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
};

// Simple yet robust Markdown Renderer supporting codeblocks, lists, headings, tables & inline code
const AssistantMarkdown: React.FC<{ content: string; onCitationClick?: (cite: string) => void }> = ({
  content,
  onCitationClick: _onCitationClick,
}) => {
  // Split into codeblocks and non-codeblocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2.5 text-[#D1D5DB] leading-relaxed text-[13.5px]">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const firstLineEnd = part.indexOf('\n');
          const language = part.slice(3, firstLineEnd).trim();
          const code = part.slice(firstLineEnd + 1, -3);
          return <CodeBlock key={index} code={code} language={language} />;
        }

        // Render regular lines
        const lines = part.split('\n');
        return (
          <div key={index} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();

              if (!trimmed) {
                return <div key={lIdx} className="h-1" />;
              }

              // Headings
              if (trimmed.startsWith('### ')) {
                return (
                  <h3 key={lIdx} className="text-sm font-semibold text-[#F5F6F8] mt-3 mb-1 font-sans">
                    {trimmed.replace('### ', '')}
                  </h3>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h2 key={lIdx} className="text-base font-bold text-[#F5F6F8] mt-3.5 mb-1.5 font-sans">
                    {trimmed.replace('## ', '')}
                  </h2>
                );
              }
              if (trimmed.startsWith('# ')) {
                return (
                  <h1 key={lIdx} className="text-lg font-bold text-[#F5F6F8] mt-4 mb-2 font-sans">
                    {trimmed.replace('# ', '')}
                  </h1>
                );
              }

              // Bullet points
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const itemContent = trimmed.slice(2);
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="text-[#7657FF] mt-1 text-xs">•</span>
                    <span>{renderInlineFormatting(itemContent)}</span>
                  </div>
                );
              }

              // Numbered list
              const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
              if (numMatch) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="text-[#8E95A2] font-mono text-xs mt-0.5">{numMatch[1]}.</span>
                    <span>{renderInlineFormatting(numMatch[2])}</span>
                  </div>
                );
              }

              return <p key={lIdx}>{renderInlineFormatting(trimmed)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
};

function renderInlineFormatting(text: string): React.ReactNode {
  // Parse inline code `code`, bold **text**, and file:line citations
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return (
    <>
      {tokens.map((token, idx) => {
        if (token.startsWith('`') && token.endsWith('`')) {
          return (
            <code
              key={idx}
              className="px-1.5 py-0.5 mx-0.5 rounded bg-[#181B22] border border-[#252932] text-[#A37BFF] font-mono text-xs"
            >
              {token.slice(1, -1)}
            </code>
          );
        }
        if (token.startsWith('**') && token.endsWith('**')) {
          return (
            <strong key={idx} className="font-semibold text-[#F5F6F8]">
              {token.slice(2, -2)}
            </strong>
          );
        }
        return token;
      })}
    </>
  );
}

export const AIAssistantPage: React.FC<AIAssistantPageProps> = ({
  repositories,
  selectedRepo,
  onSelectRepo: _onSelectRepo,
  pullRequests,
  currentAnalysis: _currentAnalysis,
  selectedFinding,
  onSelectFinding: _onSelectFinding,
}) => {
  // Conversation state
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<AssistantConversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Messaging & Streaming state
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingDelta, setStreamingDelta] = useState('');
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Context Selection state
  const [contextType, setContextType] = useState<AssistantContextType>('general');
  const [contextRepo, setContextRepo] = useState<string>(selectedRepo?.full_name || '');
  const [contextPR, setContextPR] = useState<number | undefined>(pullRequests[0]?.number);
  const [contextFindingId, setContextFindingId] = useState<string>(selectedFinding?.id || '');

  // Dynamic context options
  const [repoOptions, setRepoOptions] = useState<Array<{ full_name: string; name: string }>>([]);
  const [prOptions, setPrOptions] = useState<Array<{ number: number; title: string }>>([]);
  const [findingOptions, setFindingOptions] = useState<Array<{ id: string; title: string; severity: string }>>([]);

  // Provider configuration state
  const [providerStatus, setProviderStatus] = useState<AssistantProviderStatus | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedProviderInput, setSelectedProviderInput] = useState('gemini');
  const [selectedModelInput, setSelectedModelInput] = useState('gemini-1.5-flash');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Inline rename state
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 1. Initial Load: Load Provider Status and Conversations
  useEffect(() => {
    loadProviderStatus();
    loadConversations();
    loadRepoOptions();
  }, []);

  // Sync selectedRepo from parent if changed
  useEffect(() => {
    if (selectedRepo && !contextRepo) {
      setContextRepo(selectedRepo.full_name);
    }
  }, [selectedRepo]);

  // Load PR and Finding options when repository changes
  useEffect(() => {
    if (contextRepo) {
      fetchAssistantContextPullRequests(contextRepo)
        .then((prs) => {
          setPrOptions(prs);
          if (prs.length > 0 && !contextPR) {
            setContextPR(prs[0].number);
          }
        })
        .catch(() => setPrOptions([]));

      fetchAssistantContextFindings(contextRepo, contextPR)
        .then((findings) => {
          setFindingOptions(findings);
          if (findings.length > 0 && !contextFindingId) {
            setContextFindingId(findings[0].id);
          }
        })
        .catch(() => setFindingOptions([]));
    }
  }, [contextRepo, contextPR]);

  // Auto-scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, streamingDelta]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputMessage]);

  const loadProviderStatus = async () => {
    try {
      const status = await fetchAssistantProviderStatus();
      setProviderStatus(status);
      setSelectedProviderInput(status.configured_provider || 'gemini');
      if (status.model) {
        setSelectedModelInput(status.model);
      }
    } catch {
      // Offline fallback
    }
  };

  const loadRepoOptions = async () => {
    try {
      const repos = await fetchAssistantContextRepositories();
      setRepoOptions(repos);
    } catch {
      setRepoOptions(repositories.map((r) => ({ full_name: r.full_name, name: r.name })));
    }
  };

  const loadConversations = async (query?: string) => {
    try {
      const list = await fetchAssistantConversations(query);
      setConversations(list);
      if (list.length > 0 && !activeConvId) {
        selectConversation(list[0].id);
      } else if (list.length === 0) {
        // Automatically start fresh conversation
        handleNewChat();
      }
    } catch {
      // Fallback
    }
  };

  const selectConversation = async (convId: string) => {
    setActiveConvId(convId);
    try {
      const full = await fetchAssistantConversation(convId);
      setActiveConversation(full);
      // Restore conversation context
      if (full.selected_finding_id) {
        setContextType('finding');
        setContextFindingId(full.selected_finding_id);
      } else if (full.selected_pr_number && full.selected_repo) {
        setContextType('pull_request');
        setContextRepo(full.selected_repo);
        setContextPR(full.selected_pr_number);
      } else if (full.selected_repo) {
        setContextType('repository');
        setContextRepo(full.selected_repo);
      } else {
        setContextType('general');
      }
    } catch {
      // Handle error
    }
  };

  const handleNewChat = async () => {
    try {
      const newConv = await createAssistantConversation({
        title: 'New Chat',
        selected_repo: contextType !== 'general' ? contextRepo : undefined,
        selected_pr_number: contextType === 'pull_request' ? contextPR : undefined,
        selected_finding_id: contextType === 'finding' ? contextFindingId : undefined,
      });
      setConversations((prev) => [newConv, ...prev]);
      setActiveConvId(newConv.id);
      setActiveConversation(newConv);
      setInputMessage('');
      if (textareaRef.current) textareaRef.current.focus();
    } catch {
      // Ignore
    }
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await deleteAssistantConversation(convId);
      const remaining = conversations.filter((c) => c.id !== convId);
      setConversations(remaining);
      if (activeConvId === convId) {
        if (remaining.length > 0) {
          selectConversation(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch {
      // Error
    }
  };

  const handleStartRename = (conv: AssistantConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditTitleInput(conv.title);
  };

  const handleSaveRename = async (convId: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!editTitleInput.trim()) {
      setEditingConvId(null);
      return;
    }
    try {
      const updated = await updateAssistantConversation(convId, { title: editTitleInput.trim() });
      setConversations((prev) => prev.map((c) => (c.id === convId ? updated : c)));
      if (activeConversation?.id === convId) {
        setActiveConversation(updated);
      }
    } catch {
      // Handle error
    } finally {
      setEditingConvId(null);
    }
  };

  // Sending and streaming chat messages
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputMessage).trim();
    if (!textToSend || isGenerating) return;

    let targetConvId = activeConvId;
    if (!targetConvId) {
      const newConv = await createAssistantConversation({ title: 'New Conversation' });
      targetConvId = newConv.id;
      setActiveConvId(targetConvId);
      setActiveConversation(newConv);
    }

    // Append optimistic user message to UI
    const optimisticUserMsg: AssistantMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: targetConvId,
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString(),
    };

    setActiveConversation((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        messages: [...(prev.messages || []), optimisticUserMsg],
      };
    });

    setInputMessage('');
    setIsGenerating(true);
    setStreamingDelta('');

    const controller = new AbortController();
    setAbortController(controller);

    let accumulatedText = '';

    await streamAssistantChat(
      {
        conversation_id: targetConvId,
        message: textToSend,
        selected_repo: contextType !== 'general' ? contextRepo : undefined,
        selected_pr_number: contextType === 'pull_request' ? contextPR : undefined,
        selected_finding_id: contextType === 'finding' ? contextFindingId : undefined,
      },
      (delta) => {
        accumulatedText += delta;
        setStreamingDelta(accumulatedText);
      },
      (_doneData) => {
        setIsGenerating(false);
        setStreamingDelta('');
        setAbortController(null);
        // Refresh conversation state from backend
        if (targetConvId) {
          selectConversation(targetConvId);
          fetchAssistantConversations().then(setConversations);
        }
      },
      (errText) => {
        setIsGenerating(false);
        setStreamingDelta('');
        setAbortController(null);
        setActiveConversation((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            messages: [
              ...(prev.messages || []),
              {
                id: `err-${Date.now()}`,
                conversation_id: activeConvId || '',
                role: 'assistant',
                content: `⚠️ **AI Service Notification**\n\n${errText}\n\n*Tip: You can switch models or update your API key via the Key icon at the bottom of the left sidebar.*`,
                created_at: new Date().toISOString(),
              },
            ],
          };
        });
      },
      controller.signal
    );
  };

  const handleStopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setIsGenerating(false);
      setAbortController(null);
      if (activeConvId) {
        selectConversation(activeConvId);
      }
    }
  };

  const handleRegenerate = async () => {
    if (!activeConvId || isGenerating) return;

    setIsGenerating(true);
    setStreamingDelta('');
    const controller = new AbortController();
    setAbortController(controller);

    let accumulatedText = '';

    await streamAssistantRegenerate(
      activeConvId,
      {
        selected_repo: contextType !== 'general' ? contextRepo : undefined,
        selected_pr_number: contextType === 'pull_request' ? contextPR : undefined,
        selected_finding_id: contextType === 'finding' ? contextFindingId : undefined,
      },
      (delta) => {
        accumulatedText += delta;
        setStreamingDelta(accumulatedText);
      },
      () => {
        setIsGenerating(false);
        setStreamingDelta('');
        setAbortController(null);
        if (activeConvId) {
          selectConversation(activeConvId);
        }
      },
      (errText) => {
        setIsGenerating(false);
        setStreamingDelta('');
        setAbortController(null);
        setActiveConversation((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            messages: [
              ...(prev.messages || []),
              {
                id: `err-${Date.now()}`,
                conversation_id: activeConvId || '',
                role: 'assistant',
                content: `⚠️ **AI Service Notification**\n\n${errText}\n\n*Tip: You can switch models or update your API key via the Key icon at the bottom of the left sidebar.*`,
                created_at: new Date().toISOString(),
              },
            ],
          };
        });
      },
      controller.signal
    );
  };

  const handleSaveProviderConfig = async () => {
    setIsSavingConfig(true);
    setConfigError(null);
    try {
      const updated = await configureAssistantProvider(
        selectedProviderInput,
        apiKeyInput || undefined,
        selectedModelInput
      );
      setProviderStatus(updated);
      setIsConfigModalOpen(false);
      setApiKeyInput('');
    } catch (err: any) {
      setConfigError(err.message || 'Failed to save configuration.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 6 Suggested Prompt Cards for Empty State
  const promptCards = [
    {
      id: 'finding',
      title: 'Explain a Security Finding',
      desc: 'Explain why this security issue was detected and how it could affect my application.',
      icon: ShieldAlert,
      tag: 'Security',
      action: () => {
        setContextType('finding');
        setInputMessage('Explain why this security issue was detected, its potential impact, and how to verify the fix.');
      },
    },
    {
      id: 'pr',
      title: 'Review My Pull Request',
      desc: 'Analyze my latest pull request and identify important issues that need attention.',
      icon: GitPullRequest,
      tag: 'Review',
      action: () => {
        setContextType('pull_request');
        setInputMessage('Review this pull request. Are there any security vulnerabilities, API breaks, or missing tests?');
      },
    },
    {
      id: 'repo',
      title: 'Understand My Repository',
      desc: "Explain my application's architecture and how the frontend communicates with the backend.",
      icon: FolderGit2,
      tag: 'Architecture',
      action: () => {
        setContextType('repository');
        setInputMessage("Explain this repository's architecture and how the backend and client components interact.");
      },
    },
    {
      id: 'bugs',
      title: 'Find Potential Bugs',
      desc: 'Look for suspicious code patterns and explain what could go wrong.',
      icon: Code2,
      tag: 'Quality',
      action: () => {
        setInputMessage('What suspicious code patterns or unhandled edge cases exist in the analyzed files?');
      },
    },
    {
      id: 'fix',
      title: 'Fix an Issue',
      desc: 'Help me understand and correct this API compatibility problem.',
      icon: RotateCcw,
      tag: 'Remediation',
      action: () => {
        setInputMessage('Provide a step-by-step fix and a clean code patch for the flagged issues.');
      },
    },
    {
      id: 'tests',
      title: 'Write Tests',
      desc: 'Suggest tests that can verify the behavior affected by my latest code changes.',
      icon: HelpCircle,
      tag: 'Testing',
      action: () => {
        setInputMessage('Suggest comprehensive automated test cases to prevent regressions in these changes.');
      },
    },
  ];

  return (
    <div className="flex h-full bg-[#08090C] text-[#F5F6F8] overflow-hidden font-sans">
      {/* =========================================================================
          AREA A: COLLAPSIBLE CONVERSATION SIDEBAR
          ========================================================================= */}
      <div
        className={`${
          isSidebarOpen ? 'w-72' : 'w-0'
        } transition-all duration-300 ease-in-out border-r border-[#1C2028] bg-[#0E1015] flex flex-col overflow-hidden relative flex-shrink-0`}
      >
        {isSidebarOpen && (
          <div className="flex flex-col h-full w-72">
            {/* Sidebar Top: New Chat & Search */}
            <div className="p-3.5 space-y-3 border-b border-[#1C2028]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#707783]">
                  Conversations
                </span>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 text-[#707783] hover:text-[#F5F6F8] rounded hover:bg-[#181B22] transition-colors"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#7657FF] hover:bg-[#8B6EFF] text-[#F5F6F8] font-medium text-xs transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>New Chat</span>
              </button>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#707783]" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    loadConversations(e.target.value);
                  }}
                  className="w-full bg-[#14171E] border border-[#252932] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#F5F6F8] placeholder-[#707783] focus:outline-none focus:border-[#7657FF]"
                />
              </div>
            </div>

            {/* Conversation History List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#707783]">No conversations found.</div>
              ) : (
                conversations.map((conv) => {
                  const isActive = conv.id === activeConvId;
                  const isEditing = conv.id === editingConvId;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => selectConversation(conv.id)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                        isActive
                          ? 'bg-[#181B22] text-[#F5F6F8] border border-[#252932]'
                          : 'text-[#9299A5] hover:bg-[#14171E] hover:text-[#F5F6F8]'
                      }`}
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          value={editTitleInput}
                          onChange={(e) => setEditTitleInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(conv.id, e);
                            if (e.key === 'Escape') setEditingConvId(null);
                          }}
                          autoFocus
                          className="w-full bg-[#0E1015] border border-[#7657FF] rounded px-1.5 py-0.5 text-xs text-[#F5F6F8] focus:outline-none"
                        />
                      ) : (
                        <div className="flex flex-col truncate pr-2">
                          <span className="truncate font-medium">{conv.title}</span>
                          <span className="text-[10px] text-[#707783] mt-0.5">
                            {conv.message_count ? `${conv.message_count} msgs` : 'Active'}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isEditing ? (
                          <button
                            onClick={(e) => handleSaveRename(conv.id, e)}
                            className="p-1 hover:text-[#22C55E]"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={(e) => handleStartRename(conv, e)}
                              className="p-1 text-[#707783] hover:text-[#F5F6F8]"
                              title="Rename"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteConversation(conv.id, e)}
                              className="p-1 text-[#707783] hover:text-[#F04452]"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Provider Configuration Footer Pill */}
            <div className="p-3 border-t border-[#1C2028] bg-[#0E1015] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate">
                <span
                  className={`w-2 h-2 rounded-full ${
                    providerStatus?.is_configured ? 'bg-[#22C55E]' : 'bg-[#EAB308]'
                  }`}
                />
                <span className="text-[#9299A5] text-[11px] truncate">
                  {providerStatus?.is_configured
                    ? `${providerStatus.provider.toUpperCase()} (${providerStatus.model})`
                    : 'Setup AI Provider'}
                </span>
              </div>
              <button
                onClick={() => setIsConfigModalOpen(true)}
                className="p-1.5 rounded hover:bg-[#181B22] text-[#8E95A2] hover:text-[#F5F6F8] transition-colors"
                title="Configure LLM Provider"
              >
                <Key className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          AREA B: MAIN CONVERSATION AREA
          ========================================================================= */}
      <div className="flex-1 flex flex-col h-full bg-[#08090C] overflow-hidden relative">
        {/* Top Header Bar */}
        <div className="h-14 px-5 border-b border-[#1C2028] bg-[#08090C]/90 backdrop-blur-sm flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 text-[#707783] hover:text-[#F5F6F8] rounded hover:bg-[#181B22] transition-colors"
                title="Open sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#7657FF]/15 border border-[#7657FF]/30 flex items-center justify-center text-[#7657FF]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-xs font-bold tracking-tight text-[#F5F6F8]">REVA AI ASSISTANT</h1>
                <p className="text-[10px] text-[#707783] hidden sm:block">
                  Your intelligent development companion for code, security, and pull requests.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Active Context Badges */}
            {contextType !== 'general' && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#181B22] border border-[#252932] text-[11px] text-[#9299A5]">
                {contextType === 'repository' && <FolderGit2 className="w-3 h-3 text-[#7657FF]" />}
                {contextType === 'pull_request' && <GitPullRequest className="w-3 h-3 text-[#22C55E]" />}
                {contextType === 'finding' && <ShieldAlert className="w-3 h-3 text-[#F04452]" />}
                <span className="truncate max-w-[160px]">
                  {contextType === 'repository' && contextRepo}
                  {contextType === 'pull_request' && `${contextRepo} #${contextPR}`}
                  {contextType === 'finding' && contextFindingId}
                </span>
                <button
                  onClick={() => setContextType('general')}
                  className="hover:text-[#F04452] ml-1"
                  title="Clear context"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#252932] hover:bg-[#151820] text-xs font-medium text-[#D1D5DB] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </div>

        {/* Message Content Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
          {/* Empty State when no messages */}
          {(!activeConversation?.messages || activeConversation.messages.length === 0) && !streamingDelta ? (
            <div className="max-w-3xl mx-auto h-full flex flex-col justify-center items-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-[#7657FF]/10 border border-[#7657FF]/25 flex items-center justify-center text-[#7657FF] mb-4 shadow-lg shadow-[#7657FF]/5">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-[#F5F6F8] tracking-tight text-center">
                What are we looking into today?
              </h2>
              <p className="text-xs text-[#707783] text-center max-w-md mt-1.5 mb-8">
                Ask questions about your code, investigate security findings, understand pull requests, or get
                help solving development problems.
              </p>

              {/* 6 Suggested Prompt Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
                {promptCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.id}
                      onClick={card.action}
                      className="flex flex-col text-left p-3.5 rounded-xl border border-[#1C2028] bg-[#0E1015] hover:bg-[#14171E] hover:border-[#2A2E39] transition-all group shadow-sm"
                    >
                      <div className="flex items-center justify-between w-full mb-2">
                        <div className="w-7 h-7 rounded-lg bg-[#181B22] border border-[#252932] flex items-center justify-center text-[#9299A5] group-hover:text-[#7657FF] transition-colors">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#707783]">
                          {card.tag}
                        </span>
                      </div>
                      <h3 className="font-semibold text-xs text-[#F5F6F8] group-hover:text-[#A37BFF] transition-colors">
                        {card.title}
                      </h3>
                      <p className="text-[11px] text-[#707783] mt-1 leading-relaxed line-clamp-2">
                        {card.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Rendered Messages */
            <div className="max-w-3xl mx-auto space-y-6">
              {activeConversation?.messages?.map((msg) => {
                const isUser = msg.role === 'user';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}
                  >
                    {/* Header info */}
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <span className="text-[11px] font-semibold text-[#707783]">
                        {isUser ? 'You' : 'REVA'}
                      </span>
                    </div>

                    {/* Message Bubble / Document */}
                    <div
                      className={`max-w-[92%] md:max-w-[85%] rounded-2xl px-4 py-3 ${
                        isUser
                          ? 'bg-[#181B22] border border-[#252932] text-[#F5F6F8]'
                          : 'bg-[#0E1015] border border-[#1C2028] text-[#D1D5DB]'
                      }`}
                    >
                      <AssistantMarkdown content={msg.content} />

                      {/* Source Citations */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3.5 pt-3 border-t border-[#1C2028] space-y-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#707783] block">
                            Sources & Evidence
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.map((src, sIdx) => (
                              <span
                                key={sIdx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#14171E] border border-[#252932] font-mono text-[11px] text-[#A37BFF]"
                              >
                                <Code2 className="w-3 h-3 text-[#7657FF]" />
                                <span>
                                  {src.file}
                                  {src.line ? `:${src.line}` : ''}
                                  {src.end_line ? `-${src.end_line}` : ''}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons below assistant message */}
                    {!isUser && (
                      <div className="flex items-center gap-2 mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigator.clipboard.writeText(msg.content)}
                          className="flex items-center gap-1 text-[11px] text-[#707783] hover:text-[#F5F6F8]"
                          title="Copy message"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                        <button
                          onClick={handleRegenerate}
                          className="flex items-center gap-1 text-[11px] text-[#707783] hover:text-[#F5F6F8]"
                          title="Regenerate response"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Regenerate</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Streaming ongoing message */}
              {streamingDelta && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="text-[11px] font-semibold text-[#7657FF] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 animate-spin" /> Generating response...
                    </span>
                  </div>
                  <div className="max-w-[92%] md:max-w-[85%] rounded-2xl px-4 py-3 bg-[#0E1015] border border-[#7657FF]/30 text-[#D1D5DB]">
                    <AssistantMarkdown content={streamingDelta} />
                    <span className="inline-block w-2 h-4 bg-[#7657FF] ml-1 animate-pulse align-middle" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* =========================================================================
            AREA C: CHAT INPUT AREA (MESSAGE COMPOSER)
            ========================================================================= */}
        <div className="p-4 md:p-6 border-t border-[#1C2028] bg-[#08090C] flex-shrink-0">
          <div className="max-w-3xl mx-auto space-y-2">
            {/* Context Selector Bar */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-[#9299A5]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#707783]">
                Context:
              </span>
              <div className="flex items-center gap-1 bg-[#14171E] border border-[#252932] rounded-lg p-0.5">
                <button
                  onClick={() => setContextType('general')}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    contextType === 'general'
                      ? 'bg-[#1E232E] text-[#F5F6F8] font-medium'
                      : 'text-[#707783] hover:text-[#F5F6F8]'
                  }`}
                >
                  General
                </button>
                <button
                  onClick={() => setContextType('repository')}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    contextType === 'repository'
                      ? 'bg-[#1E232E] text-[#F5F6F8] font-medium'
                      : 'text-[#707783] hover:text-[#F5F6F8]'
                  }`}
                >
                  Repository
                </button>
                <button
                  onClick={() => setContextType('pull_request')}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    contextType === 'pull_request'
                      ? 'bg-[#1E232E] text-[#F5F6F8] font-medium'
                      : 'text-[#707783] hover:text-[#F5F6F8]'
                  }`}
                >
                  Pull Request
                </button>
                <button
                  onClick={() => setContextType('finding')}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    contextType === 'finding'
                      ? 'bg-[#1E232E] text-[#F5F6F8] font-medium'
                      : 'text-[#707783] hover:text-[#F5F6F8]'
                  }`}
                >
                  Finding
                </button>
              </div>

              {/* Dynamic Target Selectors */}
              {contextType !== 'general' && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Repo select */}
                  <select
                    value={contextRepo}
                    onChange={(e) => setContextRepo(e.target.value)}
                    className="bg-[#14171E] border border-[#252932] rounded-md px-2 py-1 text-xs text-[#F5F6F8] focus:outline-none focus:border-[#7657FF]"
                  >
                    <option value="">Select Repository...</option>
                    {repoOptions.map((r) => (
                      <option key={r.full_name} value={r.full_name}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  {/* PR select */}
                  {contextType === 'pull_request' && (
                    <select
                      value={contextPR}
                      onChange={(e) => setContextPR(Number(e.target.value))}
                      className="bg-[#14171E] border border-[#252932] rounded-md px-2 py-1 text-xs text-[#F5F6F8] focus:outline-none focus:border-[#7657FF]"
                    >
                      <option value="">Select PR...</option>
                      {prOptions.map((p) => (
                        <option key={p.number} value={p.number}>
                          #{p.number} - {p.title.slice(0, 30)}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Finding select */}
                  {contextType === 'finding' && (
                    <select
                      value={contextFindingId}
                      onChange={(e) => setContextFindingId(e.target.value)}
                      className="bg-[#14171E] border border-[#252932] rounded-md px-2 py-1 text-xs text-[#F5F6F8] focus:outline-none focus:border-[#7657FF]"
                    >
                      <option value="">Select Finding...</option>
                      {findingOptions.map((f) => (
                        <option key={f.id} value={f.id}>
                          [{f.severity.toUpperCase()}] {f.title.slice(0, 30)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Input Composer Box */}
            <div className="relative rounded-2xl bg-[#0E1015] border border-[#252932] focus-within:border-[#7657FF] transition-all shadow-lg p-2.5">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask REVA about your code, PRs, security findings, or anything you're building..."
                rows={1}
                className="w-full bg-transparent text-[#F5F6F8] placeholder-[#707783] text-[13.5px] leading-relaxed resize-none focus:outline-none px-2 pt-1 max-h-48"
              />

              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1C2028] px-1">
                <span className="text-[10px] text-[#707783]">
                  Enter to send, Shift + Enter for new line
                </span>

                <div className="flex items-center gap-2">
                  {inputMessage && (
                    <button
                      onClick={() => setInputMessage('')}
                      className="text-[11px] text-[#707783] hover:text-[#F5F6F8] px-2 py-1 rounded"
                    >
                      Clear
                    </button>
                  )}

                  {isGenerating ? (
                    <button
                      onClick={handleStopGeneration}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F04452] hover:bg-[#E03342] text-[#F5F6F8] text-xs font-semibold transition-colors"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSendMessage()}
                      disabled={!inputMessage.trim()}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        inputMessage.trim()
                          ? 'bg-[#7657FF] hover:bg-[#8B6EFF] text-[#F5F6F8] shadow-sm'
                          : 'bg-[#181B22] text-[#707783] cursor-not-allowed'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL: AI PROVIDER CONFIGURATION
          ========================================================================= */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-[#0E1015] border border-[#252932] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1C2028] pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-[#7657FF]" />
                <h3 className="font-bold text-sm text-[#F5F6F8]">Configure AI Provider</h3>
              </div>
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="text-[#707783] hover:text-[#F5F6F8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {configError && (
              <div className="p-2.5 rounded-lg bg-[#F04452]/10 border border-[#F04452]/20 text-xs text-[#F04452]">
                {configError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#8E95A2] block mb-1">Provider</label>
                <select
                  value={selectedProviderInput}
                  onChange={(e) => {
                    const nextProv = e.target.value;
                    setSelectedProviderInput(nextProv);
                    if (nextProv === 'gemini') setSelectedModelInput('gemini-1.5-flash');
                    else if (nextProv === 'openai') setSelectedModelInput('gpt-4o');
                    else if (nextProv === 'anthropic') setSelectedModelInput('claude-3-5-sonnet-20241022');
                  }}
                  className="w-full bg-[#14171E] border border-[#252932] rounded-lg px-3 py-2 text-xs text-[#F5F6F8] focus:outline-none focus:border-[#7657FF]"
                >
                  <option value="gemini">Google Gemini (Recommended - Free Tier Available)</option>
                  <option value="openai">OpenAI (GPT-4o, o3-mini)</option>
                  <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8E95A2] block mb-1">Model</label>
                <select
                  value={selectedModelInput}
                  onChange={(e) => setSelectedModelInput(e.target.value)}
                  className="w-full bg-[#14171E] border border-[#252932] rounded-lg px-3 py-2 text-xs text-[#F5F6F8] focus:outline-none focus:border-[#7657FF]"
                >
                  {selectedProviderInput === 'gemini' && (
                    <>
                      <option value="gemini-1.5-flash">gemini-1.5-flash (Recommended — Fast & Reliable)</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro (Deep Reasoning & 2M Context)</option>
                    </>
                  )}
                  {selectedProviderInput === 'openai' && (
                    <>
                      <option value="gpt-4o">gpt-4o (High Performance)</option>
                      <option value="gpt-4o-mini">gpt-4o-mini (Lightweight & Fast)</option>
                      <option value="o3-mini">o3-mini (Advanced Reasoning)</option>
                    </>
                  )}
                  {selectedProviderInput === 'anthropic' && (
                    <>
                      <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet-20241022 (Best Code Auditing)</option>
                      <option value="claude-3-5-haiku-20241022">claude-3-5-haiku-20241022 (Fast & Compact)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8E95A2] block mb-1">
                  API Key ({selectedProviderInput.toUpperCase()})
                </label>
                <input
                  type="password"
                  placeholder={
                    providerStatus?.is_configured
                      ? 'Enter new API key (or leave blank to keep current)...'
                      : 'Paste your API key...'
                  }
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full bg-[#14171E] border border-[#252932] rounded-lg px-3 py-2 text-xs text-[#F5F6F8] focus:outline-none focus:border-[#7657FF]"
                />
                <p className="text-[11px] text-[#707783] mt-1">
                  Credentials are stored securely in backend application configuration and are never exposed to
                  client JavaScript.
                </p>
              </div>

              {selectedProviderInput === 'gemini' && (
                <div className="p-2.5 rounded-lg bg-[#14171E] border border-[#252932] text-xs text-[#9299A5]">
                  <span>Get a free Gemini API key at </span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#7657FF] hover:underline inline-flex items-center gap-1"
                  >
                    Google AI Studio <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1C2028]">
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-[#252932] hover:bg-[#14171E] text-xs text-[#9299A5]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProviderConfig}
                disabled={isSavingConfig || (!apiKeyInput.trim() && !providerStatus?.is_configured)}
                className="px-4 py-1.5 rounded-lg bg-[#7657FF] hover:bg-[#8B6EFF] text-xs font-semibold text-[#F5F6F8] disabled:opacity-50"
              >
                {isSavingConfig ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
