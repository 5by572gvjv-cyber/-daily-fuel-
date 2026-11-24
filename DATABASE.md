# 数据与计算规范
采用 IndexedDB（可用 Dexie），UUID 主键，schemaVersion 迁移。日期使用用户本地日期，时间戳保存时区信息。以下为逻辑结构，实施时定义 TypeScript 类型及校验。
| 表 | 关键字段 |
|---|---|
| Foods | id,name,aliases,brand,state,basisAmount,basisUnit,nutrients,source,sourceDate,version |
| FoodUnits | id,foodId,unit,gramsOrMl,confirmed |
| Recipes | id,name,ingredients,yieldGrams,version |
| MealTemplates | id,name,items |
| DailyRecords | id,localDate,dayType,goalSnapshot,completeness |
| Meals | id,dayId,type,eatenAt,createdAt |
| MealItems | id,mealId,foodId,quantity,unit,state,nutrientSnapshot,sourceSnapshot,estimateRange,quality,status |
| NutritionGoals | id,phase,dayType,effectiveDate,kcal,protein,carbs,fat |
| PersonalMemory | id,key,value,confirmedAt |
| AI Logs | id,requestId,action,before,after,status |
| SyncQueue (P1) | id,entityId,operation,version,requestId,retryCount |

## 计算
按实际可食用重量 / 基准重量 × 基准营养值；毫升与克不可无密度直接互换。生熟重匹配对应数据；不默认套用固定转换率。菜谱按原料营养合计 × 食用成品重量 / 总成品重量，标明均匀分布及烹饪损失假设。营养表千焦除以4.184转千卡；4/4/9用于目标换算，不强行覆盖标签能量。内部保留精度，展示才舍入。缺失值为 null，汇总显示已知部分及覆盖情况。估算保存上下限和中心值；不能将范围称为统计置信区间。待补充及计划记录不计入实际总量。
## 来源与历史
包装标签优先用于对应品牌；中国食物成分数据需核实授权；USDA FoodData Central 可作为基础来源。每条数据保留出处、基准及版本，不编造数值。历史记录保存快照，食物库更新不回写历史。
## 持久化与同步
事务保存餐食和明细；请求幂等，撤销保留操作日志。JSON 备份包含 schemaVersion、全部业务数据，导入先校验、预览并备份现有数据；CSV 供阅读分析。P1 云端按用户隔离，认证及访问控制，版本冲突提示，不静默覆盖，删除使用 tombstone，重试不重复写入。浏览器存储可能被清理，提示备份。
