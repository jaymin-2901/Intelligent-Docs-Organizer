
import mediapipe as mp
print('MediaPipe version:', mp.__version__)
print('Has solutions:', hasattr(mp, 'solutions'))
hands = mp.solutions.hands.Hands()
print('Hands module loaded successfully')
hands.close()
