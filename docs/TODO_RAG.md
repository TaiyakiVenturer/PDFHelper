# RAG系統開發計劃 - TODO List

> **項目目標：** 基於Anthropic Contextual Retrieval技術，開發零成本的本地RAG問答系統

## 📋 RAG系統架構概覽

### 🏗️ 基礎RAG架構
```
PDF文件 → MinerU解析 → content_list.json → 翻譯系統 → 雙語內容
    ↓
文檔切片 → Embedding向量化 → 向量數據庫存儲
    ↓
用戶提問 → 向量檢索 → 相關文檔片段 → LLM生成答案
```

### 🚀 增強RAG架構 (Contextual Retrieval)
```
雙語內容 → 上下文生成 → 上下文化切片 → 雙重索引(Embedding+BM25)
    ↓
用戶提問 → 混合檢索 → 候選文檔 → 重排序 → 最相關文檔 → 答案生成
```

---

## 🎯 開發階段規劃

### 🏗️ 階段一：基礎RAG系統 MVP (優先級：HIGH) ✅ **已完成**

#### 1. 文檔預處理與切片 ✅ **已完成**
- [x] **智能文檔切片** 🎯 **核心功能**
  - [x] 基於content_list.json的語義邊界切片
  - [x] 支援中英雙語切片處理 (text_zh內容)
  - [x] 實現智能切片策略 (1200字符上限，100字符下限) ✅ **已實現**
  - [x] 切片大小優化 (可配置chunk_size_limit)
  - [x] 保留metadata信息 (頁碼、內容類型、翻譯信息)

- [x] **切片品質控制** ✅ **已完成**
  - [x] 過濾空白或無意義切片 (過濾無翻譯metadata)
  - [x] 合併過短的相鄰切片 (merge_short_chunks功能)
  - [x] 不同內容類型差異化處理 (title/abstract/body/reference)
  - [x] 處理跨頁面的長段落 ✅ **已實現** (基於內容完整性分割)
  - [x] 自動生成唯一切片ID (文檔名+索引+內容哈希) ✅ **已實現**

#### 2. 本地Embedding系統 ✅ **已完成**
- [x] **Embedding模型集成** ✅ **已完成**
  - [x] 整合Ollama embedding服務 (nomic-embed-v2-text-moe)
  - [x] 支援多種embedding模型切換 ✅ **通過配置實現**
  - [x] 實現批次向量化處理 (10個文檔批次處理)
  - [x] 向量維度標準化處理 (768維度)
  - [x] 錯誤重試和降級機制 (最多3次重試)

- [x] **向量數據庫建置** ✅ **已完成**
  - [x] 選擇並配置向量數據庫 (ChromaDB)
  - [x] 設計索引結構和metadata schema
  - [x] 實現增量索引更新 (重新創建集合機制)
  - [x] 向量相似度搜索優化 (cosine相似度)
  - [x] 集合管理和緩存機制 (3個集合緩存限制)
  - [x] 數據導入導出功能 ✅ **已實現**

#### 3. 基礎問答系統 ✅ **已完成**
- [x] **檢索引擎** ✅ **已完成**
  - [x] 實現語義相似度檢索 (基於embedding)
  - [x] 支援top-k結果返回 (預設k=3，可配置)
  - [x] 檢索結果過濾和去重 ✅ **已實現**
  - [x] 檢索性能監控和調優 (包含相似度分數)

- [x] **答案生成** ✅ **已完成**
  - [x] **優先使用Gemini API** (gemini-2.5-flash-lite) ✅ **已實現**
  - [x] 集成本地LLM作為備用 (Ollama服務) ✅ **已實現**
  - [x] 設計問答專用提示詞模板 ✅ **已實現**
  - [x] 實現上下文窗口管理 (智能文檔片段組合) ✅ **已實現**
  - [x] 答案品質評估機制 (響應時間監控：0.16秒) ✅ **已實現**
  - [x] 智能模型選擇策略 (可用性檢查) ✅ **已實現**

### 🔧 階段二：Contextual Retrieval增強 (優先級：MEDIUM) ⚠️ **暫緩MVP後**

> **說明**: Contextual Retrieval是在embedding前為每個切片增加上下文信息，提升檢索準確性。
> 這是高級功能，MVP完成後再實現。

#### 4. Contextual Embeddings實現 ⚠️ **暫緩**
- [ ] **上下文生成系統** 🌟 **創新功能 - 暫緩**
  - [ ] 實現文檔級上下文理解
  - [ ] 為每個切片生成50-100 token上下文
  - [ ] **優先使用Gemini API** (1M上下文窗口優勢) 🚀
  - [ ] 本地LLM作為備用方案 (零成本)
  - [ ] 上下文品質評估和優化
  - [ ] 批次上下文生成處理
  - [ ] 上下文結果緩存機制

**Contextual Embeddings原理：**
> 為每個文檔切片添加解釋性上下文，使切片在脫離原文檔時仍能被正確理解。
> 
> **例子：**
> - 原始切片：「該公司第二季度收入增長3%」
> - 上下文化：「此段來自ACME公司2023年Q2財報，上季度收入為3.14億美元。該公司第二季度收入增長3%」

**實現步驟：**
1. 載入完整論文文檔
2. 對每個切片使用LLM生成上下文
3. 將上下文前置到原始切片
4. 對上下文化切片進行embedding
5. 建立上下文化向量索引

#### 5. Contextual BM25實現 ⚠️ **暫緩**
- [ ] **BM25索引系統** 📊 **傳統檢索增強 - 暫緩**
  - [ ] 實現BM25算法 (使用rank_bm25庫)
  - [ ] 對上下文化文檔建立倒排索引
  - [ ] 支援中英雙語分詞處理
  - [ ] TF-IDF權重計算優化
  - [ ] 精確詞彙匹配檢索

**Contextual BM25原理：**
> BM25是基於TF-IDF的排序函數，專門用於精確匹配查詢詞彙，補充語義檢索的不足。
>
> **核心公式：**
> ```
> BM25(q,d) = Σ IDF(qi) × f(qi,d) × (k1+1) / (f(qi,d) + k1×(1-b+b×|d|/avgdl))
> ```
> - f(qi,d)：詞彙qi在文檔d中的頻率
> - |d|：文檔長度
> - avgdl：平均文檔長度

**實現流程：**
1. 對上下文化切片進行分詞處理
2. 建立詞彙-文檔倒排索引
3. 計算每個詞彙的IDF值
4. 查詢時計算BM25分數
5. 返回高分匹配文檔

**增加的步驟：**
- 在原有embedding檢索基礎上並行執行BM25檢索
- 合併兩種檢索結果
- 使用rank fusion技術統一排序

#### 6. 混合檢索系統
- [ ] **雙重檢索引擎**
  - [ ] 並行執行Embedding和BM25檢索
  - [ ] 實現檢索結果融合算法
  - [ ] 支援檢索權重動態調整
  - [ ] 檢索結果去重和排序

### ⚡ 階段三：高級優化功能 (優先級：MEDIUM)

#### 7. Reranking重排序系統
- [ ] **智能重排序實現** 🎖️ **性能提升67%**
  - [ ] **優先使用Gemini API** (更準確的相關性判斷) ⚡
  - [ ] 本地LLM重排序作為備用 (成本控制)
  - [ ] 實現批次重排序處理
  - [ ] 設計重排序提示詞模板
  - [ ] 重排序結果緩存機制
  - [ ] 混合評分策略 (API + 本地)

**Reranking原理：**
> 重排序是對初始檢索結果的二次精煉，使用更複雜的相關性判斷提升最終結果品質。
>
> **工作原理：**
> 1. 初始檢索獲得大量候選文檔 (如150個)
> 2. 使用專門的重排序模型評估每個文檔與查詢的相關性
> 3. 基於相關性分數重新排序
> 4. 選取top-K最相關文檔 (如20個)

**實際流程：**
```python
# 1. 初始檢索 (混合檢索)
candidates = hybrid_search(query, top_k=150)

# 2. 重排序評分
for doc in candidates:
    score = reranker.score(query, doc)

# 3. 重新排序
reranked_docs = sorted(candidates, key=lambda x: x.score, reverse=True)

# 4. 選取top-K
final_results = reranked_docs[:20]
```

**增加的步驟：**
- 在混合檢索後添加重排序階段
- 實現本地LLM相關性評分
- 對檢索結果重新排序

#### 8. 系統性能優化
- [ ] **檢索性能優化**
  - [ ] 實現結果緩存機制
  - [ ] 並行檢索處理
  - [ ] 索引壓縮和加速
  - [ ] 內存使用優化

- [ ] **用戶體驗優化**
  - [ ] 流式答案生成
  - [ ] 檢索進度顯示
  - [ ] 來源引用追蹤
  - [ ] 問答歷史管理

---

## 🎯 **已實現的核心功能總結** ✅

### **RAG系統核心組件**
- **文檔處理器 (DocumentProcessor)**: 完整的文檔切片和品質控制系統
- **向量嵌入服務 (EmbeddingService)**: 基於Ollama的高效向量化服務  
- **向量數據庫 (ChromaVectorStore)**: ChromaDB集成，支援持久化和集合管理
- **RAG引擎 (RAGEngine)**: 完整的檢索-生成管道，整合所有組件

### **LLM服務架構**
- **Gemini服務 (GeminiService)**: Google Gemini API集成，高品質回答生成
- **Ollama服務 (OllamaService)**: 本地LLM服務，embedding和備用答案生成
- **統一接口設計**: 支援服務可用性檢查和智能切換

### **翻譯服務系統**  
- **翻譯器基類 (TranslatorBase)**: 統一翻譯接口和進度管理
- **Gemini翻譯器 (GeminiTranslator)**: 雲端高品質翻譯
- **Ollama翻譯器 (OllamaTranslator)**: 本地翻譯服務

### **系統整合測試**
- **全面功能測試**: test_rag_system.py驗證所有組件正常運作
- **性能指標**: 10個文檔切片，768維向量，0.16秒回答時間
- **多語言支援**: 完整的中英雙語處理和檢索能力

---

## 🚀 **下一階段重點任務**

### **Gemini API vs 本地模型優劣分析**

#### **Gemini-2.5-flash-lite 優勢場景：**

**1. 🌟 上下文生成 (建議使用API)**
```python
# Gemini優勢：1M token上下文 vs Yi-1.5-6B的4K token
full_document = load_complete_paper()  # 可能50K+ tokens
contextual_prompt = f"""
<document>
{full_document}  # Gemini可以處理完整文檔！
</document>
為此切片生成上下文：{chunk_text}
"""
```
**為什麼選擇API：**
- ✅ **超長上下文**：1M tokens vs 4K tokens，能理解完整論文
- ✅ **理解品質**：更好的文檔結構理解
- ✅ **一次性成本**：上下文生成可以緩存，不會重複計費
- ✅ **處理速度**：雲端GPU比本地快很多

**2. 🎯 最終問答 (建議使用API)**
```python
# 用戶直接交互，品質最重要
final_answer = gemini.generate_answer(
    query=user_question,
    context=retrieved_contexts,  # 可能包含大量上下文
    previous_qa_history=history  # 支持長對話歷史
)
```
**為什麼選擇API：**
- ✅ **用戶體驗**：直接影響使用滿意度
- ✅ **複雜推理**：更好的邏輯推理能力
- ✅ **語言品質**：更自然流暢的回答
- ✅ **多輪對話**：支持長對話上下文

**3. 🎖️ 重排序評分 (建議混合策略)**
```python
# 混合評分：API負責複雜判斷，本地負責簡單過濾
def hybrid_reranking(query, candidates):
    # 第一輪：本地LLM快速過濾
    filtered = local_llm_filter(candidates, top_k=50)
    
    # 第二輪：Gemini精確評分
    final_ranked = gemini_rerank(query, filtered, top_k=20)
    
    return final_ranked
```

#### **Yi-1.5-6B 優勢場景：**

**1. 📝 切片處理 (建議本地)**
- 簡單的文本清理和格式化
- 不需要複雜理解，本地足夠

**2. 🔍 輔助檢索 (建議本地)**
- 查詢擴展和同義詞生成
- 簡單的實體識別

**3. 💰 成本控制備用 (建議本地)**
- 當API額度用完時的降級方案
- 離線使用場景

### **成本優化策略**

#### **智能模型選擇器**
```python
class SmartModelSelector:
    def __init__(self):
        self.gemini_budget = 1000  # 每月預算 (requests)
        self.gemini_used = 0
        self.local_model = Yi15B()
        self.gemini_model = GeminiTranslator()
    
    def select_model_for_task(self, task_type, complexity_score):
        if task_type == "context_generation":
            return self.gemini_model  # 始終使用API
        
        elif task_type == "final_answer":
            if complexity_score > 0.8:  # 複雜問題
                return self.gemini_model
            else:
                return self.local_model  # 簡單問題用本地
        
        elif task_type == "reranking":
            if self.gemini_used < self.gemini_budget * 0.7:
                return self.gemini_model
            else:
                return self.local_model  # 接近預算時用本地
        
        else:
            return self.local_model  # 默認本地
```

#### **緩存策略降低成本**
```python
# 上下文生成結果緩存
context_cache = {}
def cached_context_generation(chunk_text, document_hash):
    cache_key = f"{document_hash}:{hash(chunk_text)}"
    if cache_key in context_cache:
        return context_cache[cache_key]
    
    # 只有新內容才調用API
    context = gemini.generate_context(chunk_text, document)
    context_cache[cache_key] = context
    return context
```

---

## �🛠️ 技術棧與模型選擇

### Embedding模型選項
| 模型名稱 | 維度 | 語言支持 | 本地部署 | 推薦度 |
|----------|------|----------|----------|--------|
| **nomic-embed-v2-text-moe** | 768 | 多語言 | Ollama | ⭐⭐⭐⭐⭐ |
| nomic-embed-v1.5-text | 768 | 英文主導 | Ollama | ⭐⭐⭐⭐ |
| all-MiniLM-L6-v2 | 384 | 英文 | Sentence-Transformers | ⭐⭐⭐ |
| paraphrase-multilingual-MiniLM | 384 | 多語言 | Sentence-Transformers | ⭐⭐⭐⭐ |

### 向量數據庫選項
| 數據庫 | 類型 | 部署方式 | 適用場景 | 推薦度 |
|--------|------|----------|----------|--------|
| **ChromaDB** | 文檔型 | 本地/嵌入 | 開發測試 | ⭐⭐⭐⭐⭐ |
| FAISS | 向量索引 | 本地 | 高性能檢索 | ⭐⭐⭐⭐ |
| Qdrant | 向量引擎 | 本地/服務 | 生產環境 | ⭐⭐⭐⭐ |

### LLM模型選項 (問答生成)
| 模型名稱 | 參數量 | 上下文長度 | 推理速度 | 使用場景 | 推薦度 |
|----------|---------|------------|----------|----------|--------|
| **Gemini-2.5-flash-lite** | 大型 | 1M tokens | 極快 | 複雜問答、上下文生成 | ⭐⭐⭐⭐⭐ |
| **Yi-1.5-6B** | 6B | 4K | 快 | 簡單問答、本地部署 | ⭐⭐⭐⭐ |
| Llama3.2-3B | 3B | 8K | 很快 | 輕量問答 | ⭐⭐⭐⭐ |
| Qwen2.5-7B | 7B | 32K | 中等 | 平衡性能 | ⭐⭐⭐⭐ |

### 混合LLM策略建議
| 功能模組 | 推薦模型 | 原因 | 成本考量 |
|----------|----------|------|----------|
| **上下文生成** | **Gemini-2.5-flash-lite** | 需要全文檔理解，1M上下文優勢巨大 | 一次性成本，可緩存 |
| **重排序評分** | **Gemini-2.5-flash-lite** | 準確性要求高，影響最終效果 | 頻繁調用，需控制成本 |
| **最終問答** | **Gemini-2.5-flash-lite** | 用戶直接體驗，品質最重要 | 核心功能，值得投入 |
| **切片處理** | Yi-1.5-6B | 簡單任務，本地足夠 | 零成本 |
| **基礎檢索** | 無需LLM | 純向量/BM25檢索 | 零成本 |

### 重排序模型選項
| 方案 | 成本 | 效果 | 適用場景 | 推薦度 |
|------|------|------|----------|--------|
| **Gemini API評分** | 低成本 | 最佳 | 複雜查詢、重要問題 | ⭐⭐⭐⭐⭐ |
| **混合重排序** | 極低 | 很好 | 平衡效果與成本 | ⭐⭐⭐⭐⭐ |
| **本地LLM評分** | 免費 | 良好 | 成本敏感場景 | ⭐⭐⭐⭐ |
| sentence-transformers重排 | 免費 | 中等 | 輕量級方案 | ⭐⭐⭐ |

---

## 📅 時間規劃建議

| 階段 | 預估工時 | 優先級 | 里程碑 | 狀態 |
|------|----------|---------|---------|---------|
| 階段一 | 2-3週 | HIGH | 基礎RAG問答可用 | **70%完成** ✅ |
| 階段二 | 2-3週 | HIGH | Contextual Retrieval上線 | **規劃中** |
| 階段三 | 1-2週 | MEDIUM | 重排序和性能優化 | **規劃中** |

## 🎯 近期重點工作 (本週目標)

### **🎯 本週任務** ⚡ **已大部分完成**

1. **文檔切片系統實現** ✅ **已完成**
   - ✅ 基於content_list.json設計智能切片算法
   - ✅ 支援雙語內容切片處理
   - ✅ 實現切片metadata保持

2. **Embedding索引建立** ✅ **已完成**
   - ✅ 配置nomic-embed-v2-text-moe模型
   - ✅ 建立ChromaDB向量數據庫
   - ✅ 實現基礎向量檢索功能

3. **簡單問答原型** ⚡ **下一步**
   - [ ] 整合本地LLM生成答案
   - [ ] 設計基礎問答提示詞
   - [ ] 端到端功能驗證

### **🚀 下週目標**

1. **Contextual Embeddings**
   - 實現本地上下文生成
   - 建立上下文化向量索引
   - 檢索效果對比測試

2. **BM25混合檢索**
   - 實現BM25索引系統
   - 開發混合檢索算法
   - 性能基準測試

3. **系統整合測試**
   - 端到端功能驗證
   - 檢索準確率評估
   - 用戶體驗優化

---

## 📊 預期性能指標

### **檢索準確率目標**
| 實現階段 | 預期改善 | 具體指標 |
|----------|----------|----------|
| 基礎RAG | 基準線 | 檢索失敗率 ~8-10% |
| + Contextual Embeddings | 35%改善 | 檢索失敗率 ~5-7% |
| + Contextual BM25 | 49%改善 | 檢索失敗率 ~4-5% |
| + Reranking | 67%改善 | 檢索失敗率 ~2-3% |

### **系統性能目標**
- **檢索延遲**：< 2秒 (單次查詢)
- **索引建立**：< 30秒 (單篇論文)
- **內存使用**：< 4GB (中等大小論文)
- **準確率**：> 85% (相關文檔檢索)

---

## 💡 創新特色

### **創新特色**

### **智能混合架構** 🧠
- ✅ **成本效益最大化**：關鍵功能用API，輔助功能用本地
- ✅ **品質保證**：用戶體驗關鍵環節使用最佳模型
- ✅ **靈活降級**：API不可用時自動切換本地模型
- ✅ **智能預算管理**：根據使用情況動態選擇模型

### **零到低成本架構**
- ✅ 大部分功能完全本地化部署
- ✅ 僅關鍵環節使用少量API調用
- ✅ 智能緩存減少重複API請求
- ✅ 數據隱私安全 (敏感內容可選本地處理)

### **技術創新**
- 🌟 基於Anthropic最新Contextual Retrieval
- 🌟 中英雙語上下文生成
- 🌟 本地LLM重排序
- 🌟 多模態內容理解 (文本+圖表)

### **用戶體驗**
- 📱 智能問答界面
- 📊 來源引用追蹤
- 🔍 多級檢索展示
- 💾 問答歷史管理

---

## 📝 備註

- 此RAG系統將與現有的PDF處理和翻譯系統無縫集成
- 優先使用本地資源，確保零成本運行
- 採用模組化設計，便於功能擴展和性能調優
- 建議採用敏捷開發，每個階段結束後進行效果評估

---

*最後更新時間：2025年9月5日*  
*項目狀態：RAG基礎架構已完成70%，準備實現問答引擎*  
*當前版本：v1.1 - Embedding和ChromaDB實現完成*
