// frontend_nextjs/src/services/test-history.service.ts
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    limit,
    getDocs,
    doc,
    deleteDoc,
    setDoc,
    Timestamp,
    Query,
    DocumentData
  } from 'firebase/firestore';
  import type { Firestore } from 'firebase/firestore';
  import type { TestAttempt, UserProgress, TestRecommendation } from '@/types/test-history';
  
  /**
   * Service để quản lý lịch sử làm bài và phân tích tiến độ học tập
   */
  export class TestHistoryService {
    constructor(private firestore: Firestore) {}
  
    /**
     * Lưu kết quả bài kiểm tra vào Firestore
     * @param attempt - Dữ liệu kết quả bài làm (không có id)
     * @returns ID của document vừa tạo
     */
    async saveTestAttempt(attempt: Omit<TestAttempt, 'id'>): Promise<string> {
      try {
        const attemptsRef = collection(this.firestore, 'testAttempts');
        
        // Chuyển đổi Date sang Firestore Timestamp
        const docData = {
          ...attempt,
          startedAt: Timestamp.fromDate(attempt.startedAt),
          completedAt: Timestamp.fromDate(attempt.completedAt)
        };
        
        // Thêm document mới
        const docRef = await addDoc(attemptsRef, docData);
        console.log('✅ Test attempt saved:', docRef.id);
        
        // Cập nhật thống kê người dùng
        await this.updateUserProgress(attempt.userId);
        
        return docRef.id;
      } catch (error) {
        console.error('❌ Error saving test attempt:', error);
        throw error;
      }
    }
  
    /**
     * Lấy lịch sử làm bài của user (sắp xếp từ mới đến cũ)
     * @param userId - ID của user
     * @param limitCount - Số lượng bài tối đa (mặc định 10)
     * @returns Danh sách các lần làm bài
     */
    async getUserAttempts(userId: string, limitCount: number = 10): Promise<TestAttempt[]> {
      try {
        const attemptsRef = collection(this.firestore, 'testAttempts');
        const q = query(
          attemptsRef,
          where('userId', '==', userId),
          orderBy('completedAt', 'desc'),
          limit(limitCount)
        );
        
        const snapshot = await getDocs(q);
        
        const attempts: TestAttempt[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Chuyển Timestamp về Date
            startedAt: data.startedAt?.toDate() || new Date(),
            completedAt: data.completedAt?.toDate() || new Date()
          } as TestAttempt;
        });
        
        console.log(`📚 Loaded ${attempts.length} attempts for user ${userId}`);
        return attempts;
      } catch (error) {
        console.error('❌ Error loading user attempts:', error);
        return [];
      }
    }
  
    /**
     * Phân tích và cập nhật tiến độ học tập của user
     * @param userId - ID của user
     */
    async updateUserProgress(userId: string): Promise<void> {
      try {
        // Lấy 20 bài gần nhất để phân tích
        const attempts = await this.getUserAttempts(userId, 20);
        
        if (attempts.length === 0) {
          console.log('⚠️ No attempts found for user');
          return;
        }
  
        // 1. Tính điểm trung bình
        const averageScore = attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length;
        
        // 2. Phân tích chủ đề
        const topicStats = this.analyzeTopicPerformance(attempts);
        
        const strongTopics = Object.entries(topicStats)
          .filter(([_, stats]) => stats.percentage > 80)
          .map(([topic]) => topic)
          .slice(0, 5); // Giới hạn 5 chủ đề mạnh nhất
        
        const weakTopics = Object.entries(topicStats)
          .filter(([_, stats]) => stats.percentage < 60)
          .map(([topic]) => topic)
          .slice(0, 5); // Giới hạn 5 chủ đề yếu nhất
        
        // 3. Xu hướng điểm (5 lần gần nhất)
        const recentScores = attempts.slice(0, 5).map(a => a.score);
        const improvementRate = this.calculateImprovementRate(recentScores);
        
        // 4. Đề xuất độ khó
        const recommendedDifficulty = this.recommendDifficulty(averageScore, improvementRate);
        
        // 5. Tạo object UserProgress
        const progress: UserProgress = {
          userId,
          totalTests: attempts.length,
          averageScore,
          totalTimeSpent: attempts.reduce((sum, a) => sum + a.timeSpent, 0),
          strongTopics,
          weakTopics,
          recentScores,
          improvementRate,
          recommendedTopics: weakTopics.slice(0, 3), // Top 3 để ưu tiên
          recommendedDifficulty,
          lastUpdated: new Date()
        };
        
        // 6. Lưu vào Firestore (dùng setDoc để overwrite)
        const progressRef = doc(this.firestore, 'userProgress', userId);
        await setDoc(progressRef, {
          ...progress,
          lastUpdated: Timestamp.fromDate(progress.lastUpdated)
        });
        
        console.log('✅ User progress updated:', userId);
      } catch (error) {
        console.error('❌ Error updating user progress:', error);
        throw error;
      }
    }
  
    /**
     * Phân tích điểm theo chủ đề từ danh sách attempts
     * @param attempts - Danh sách các lần làm bài
     * @returns Object chứa stats của từng chủ đề
     */
    private analyzeTopicPerformance(attempts: TestAttempt[]): {
      [topic: string]: { correct: number; total: number; percentage: number };
    } {
      const topicMap: { [topic: string]: { correct: number; total: number } } = {};
      
      attempts.forEach(attempt => {
        attempt.answers.forEach(answer => {
          const topic = answer.topic || attempt.topic;
          
          // Khởi tạo topic nếu chưa có
          if (!topicMap[topic]) {
            topicMap[topic] = { correct: 0, total: 0 };
          }
          
          topicMap[topic].total++;
          if (answer.isCorrect) {
            topicMap[topic].correct++;
          }
        });
      });
      
      // Tính phần trăm cho mỗi topic
      return Object.entries(topicMap).reduce((acc, [topic, stats]) => {
        acc[topic] = {
          ...stats,
          percentage: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0
        };
        return acc;
      }, {} as any);
    }
  
    /**
     * Tính tỷ lệ cải thiện dựa trên điểm gần đây
     * @param scores - Mảng điểm (mới nhất đến cũ nhất)
     * @returns Phần trăm cải thiện (dương = tiến bộ, âm = tụt)
     */
    private calculateImprovementRate(scores: number[]): number {
      if (scores.length < 2) return 0;
      
      // Chia làm 2 nửa: mới vs cũ
      const midPoint = Math.ceil(scores.length / 2);
      const recent = scores.slice(0, midPoint);
      const older = scores.slice(midPoint);
      
      // Tính trung bình mỗi nửa
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      
      // Tính % thay đổi
      if (olderAvg === 0) return 0;
      return ((recentAvg - olderAvg) / olderAvg) * 100;
    }
  
    /**
     * Đề xuất độ khó phù hợp dựa trên điểm số và xu hướng
     * @param averageScore - Điểm trung bình
     * @param improvementRate - Tỷ lệ cải thiện (%)
     * @returns Độ khó được đề xuất
     */
    private recommendDifficulty(
      averageScore: number, 
      improvementRate: number
    ): 'easy' | 'medium' | 'hard' {
      // Nếu điểm cao và đang tiến bộ → thử thách cao hơn
      if (averageScore > 85 && improvementRate > 5) return 'hard';
      
      // Nếu điểm khá → giữ medium
      if (averageScore > 70) return 'medium';
      
      // Nếu điểm thấp hoặc đang tụt → dễ hơn để build confidence
      if (averageScore < 60 || improvementRate < -5) return 'easy';
      
      return 'medium';
    }
  
    /**
     * Lấy danh sách đề xuất bài kiểm tra cho user
     * @param userId - ID của user
     * @returns Danh sách gợi ý bài kiểm tra
     */
    async getRecommendations(userId: string): Promise<TestRecommendation[]> {
      try {
        // Lấy progress của user
        const progressRef = doc(this.firestore, 'userProgress', userId);
        const progressSnap = await getDocs(
          query(
            collection(this.firestore, 'userProgress'),
            where('userId', '==', userId),
            limit(1)
          )
        );
        
        // Nếu user mới (chưa có progress)
        if (progressSnap.empty) {
          console.log('📝 New user - providing default recommendations');
          return [{
            topic: 'Tổng hợp',
            difficulty: 'medium',
            reason: 'Bắt đầu với bài kiểm tra tổng quan để đánh giá năng lực',
            priority: 'high'
          }];
        }
        
        const progress = progressSnap.docs[0].data() as UserProgress;
        const recommendations: TestRecommendation[] = [];
        
        // 1. Ưu tiên chủ đề yếu (priority: high)
        progress.weakTopics.slice(0, 2).forEach(topic => {
          recommendations.push({
            topic,
            difficulty: 'easy', // Bắt đầu với dễ để build confidence
            reason: `Cần cải thiện: Điểm hiện tại dưới 60%. Hãy luyện tập thêm để nắm vững kiến thức!`,
            priority: 'high'
          });
        });
        
        // 2. Bài tổng hợp (priority: medium)
        recommendations.push({
          topic: 'Tổng hợp',
          difficulty: progress.recommendedDifficulty,
          reason: 'Ôn tập toàn diện kiến thức đã học, củng cố nền tảng vững chắc',
          priority: 'medium'
        });
        
        // 3. Thử thách (priority: low) - chỉ nếu đang tiến bộ tốt
        if (progress.improvementRate > 10 && progress.averageScore > 75) {
          const challengeTopic = progress.strongTopics[0] || 'Nâng cao';
          recommendations.push({
            topic: challengeTopic,
            difficulty: 'hard',
            reason: `Bạn đang tiến bộ rất tốt (+${progress.improvementRate.toFixed(0)}%)! Thử thách bản thân với câu hỏi khó hơn`,
            priority: 'low'
          });
        }
        
        // 4. Chủ đề chưa làm nhiều
        if (recommendations.length < 4) {
          recommendations.push({
            topic: 'Khám phá mới',
            difficulty: 'medium',
            reason: 'Mở rộng kiến thức với các chủ đề bạn chưa làm nhiều',
            priority: 'medium'
          });
        }
        
        console.log(`💡 Generated ${recommendations.length} recommendations for user ${userId}`);
        return recommendations;
      } catch (error) {
        console.error('❌ Error getting recommendations:', error);
        
        // Fallback nếu có lỗi
        return [{
          topic: 'Tổng hợp',
          difficulty: 'medium',
          reason: 'Bài kiểm tra tổng quan để đánh giá năng lực',
          priority: 'high'
        }];
      }
    }
  
    /**
     * Lấy thống kê nhanh cho widget (dùng cho dashboard)
     * @param userId - ID của user
     * @returns Object chứa stats cơ bản
     */
    async getQuickStats(userId: string): Promise<{
      recentScore: number | null;
      totalTests: number;
      totalTime: number;
      trend: 'up' | 'down' | 'neutral';
    } | null> {
      try {
        const attempts = await this.getUserAttempts(userId, 5);
        
        if (attempts.length === 0) {
          return null;
        }
  
        const recentScore = attempts[0].score;
        const totalTests = attempts.length;
        const totalTime = attempts.reduce((sum, a) => sum + a.timeSpent, 0);
        
        // Tính xu hướng
        let trend: 'up' | 'down' | 'neutral' = 'neutral';
        if (attempts.length >= 2) {
          const recent = attempts[0].score;
          const previous = attempts[1].score;
          if (recent > previous + 5) trend = 'up';
          else if (recent < previous - 5) trend = 'down';
        }
        
        return { recentScore, totalTests, totalTime, trend };
      } catch (error) {
        console.error('❌ Error getting quick stats:', error);
        return null;
      }
    }
  
    /**
     * Xóa toàn bộ dữ liệu của user (GDPR compliance)
     * ⚠️ Cẩn thận: Không thể hoàn tác!
     * @param userId - ID của user
     */
    async deleteUserData(userId: string): Promise<void> {
        try {
          // Xóa attempts
          const attemptsRef = collection(this.firestore, 'testAttempts');
          const attemptsQuery = query(attemptsRef, where('userId', '==', userId));
          const attemptsSnap = await getDocs(attemptsQuery);
          
          const deletePromises = attemptsSnap.docs.map(docSnapshot => 
            deleteDoc(docSnapshot.ref)
          );
          
          // Xóa progress
          const progressRef = doc(this.firestore, 'userProgress', userId);
          deletePromises.push(deleteDoc(progressRef));
          
          await Promise.all(deletePromises);
          
          console.log(`🗑️ Deleted all data for user ${userId}`);
        } catch (error) {
          console.error('❌ Error deleting user data:', error);
          throw error;
        }
      }
  }