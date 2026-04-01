import re
from datetime import datetime
from collections import defaultdict

class DeadlineExtractor:
    """Extract deadlines, exam dates, and important dates from text"""
    
    def __init__(self):
        # Month patterns
        self.months = {
            'january': 1, 'jan': 1,
            'february': 2, 'feb': 2,
            'march': 3, 'mar': 3,
            'april': 4, 'apr': 4,
            'may': 5,
            'june': 6, 'jun': 6,
            'july': 7, 'jul': 7,
            'august': 8, 'aug': 8,
            'september': 9, 'sep': 9, 'sept': 9,
            'october': 10, 'oct': 10,
            'november': 11, 'nov': 11,
            'december': 12, 'dec': 12
        }
        
        # Deadline keywords
        self.deadline_keywords = [
            'deadline', 'due', 'submit', 'submission', 'exam', 'test',
            'quiz', 'midterm', 'final', 'assignment', 'project',
            'presentation', 'report', 'homework', 'paper'
        ]
    
    def extract(self, text):
        """Extract all important dates from text"""
        dates = []
        
        # Extract various date formats
        dates.extend(self._extract_mmddyyyy(text))
        dates.extend(self._extract_ddmmmyyyy(text))
        dates.extend(self._extract_mmmddyyyy(text))
        dates.extend(self._extract_relative_dates(text))
        
        # Remove duplicates and sort
        seen = set()
        unique_dates = []
        for date in dates:
            key = (date['date'], date['context'])
            if key not in seen:
                seen.add(key)
                unique_dates.append(date)
        
        # Sort by date
        unique_dates.sort(key=lambda x: x.get('parsed_date', datetime.max))
        
        return unique_dates
    
    def _extract_mmddyyyy(self, text):
        """Extract dates in MM/DD/YYYY or MM-DD-YYYY format"""
        dates = []
        pattern = r'\b(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})\b'
        
        for match in re.finditer(pattern, text):
            month, day, year = match.groups()
            try:
                year = int(year)
                if year < 100:
                    year += 2000
                
                date_str = f"{int(month):02d}/{int(day):02d}/{year}"
                context = self._get_context(text, match.start())
                
                dates.append({
                    'date': date_str,
                    'format': 'MM/DD/YYYY',
                    'context': context,
                    'type': self._classify_deadline(context),
                    'parsed_date': datetime(year, int(month), int(day))
                })
            except ValueError:
                continue
        
        return dates
    
    def _extract_ddmmmyyyy(self, text):
        """Extract dates like '15 March 2024' or '15 Mar 2024'"""
        dates = []
        pattern = r'\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{2,4})\b'
        
        for match in re.finditer(pattern, text, re.IGNORECASE):
            day, month_str, year = match.groups()
            try:
                month = self.months.get(month_str.lower(), 0)
                year = int(year)
                if year < 100:
                    year += 2000
                
                date_str = f"{month:02d}/{int(day):02d}/{year}"
                context = self._get_context(text, match.start())
                
                dates.append({
                    'date': date_str,
                    'format': 'DD Month YYYY',
                    'context': context,
                    'type': self._classify_deadline(context),
                    'parsed_date': datetime(year, month, int(day))
                })
            except (ValueError, KeyError):
                continue
        
        return dates
    
    def _extract_mmmddyyyy(self, text):
        """Extract dates like 'March 15, 2024' or 'Mar 15 2024'"""
        dates = []
        pattern = r'\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})\b'
        
        for match in re.finditer(pattern, text, re.IGNORECASE):
            month_str, day, year = match.groups()
            try:
                month = self.months.get(month_str.lower(), 0)
                year = int(year)
                if year < 100:
                    year += 2000
                
                date_str = f"{month:02d}/{int(day):02d}/{year}"
                context = self._get_context(text, match.start())
                
                dates.append({
                    'date': date_str,
                    'format': 'Month DD, YYYY',
                    'context': context,
                    'type': self._classify_deadline(context),
                    'parsed_date': datetime(year, month, int(day))
                })
            except (ValueError, KeyError):
                continue
        
        return dates
    
    def _extract_relative_dates(self, text):
        """Extract relative dates like 'next Monday', 'in 2 weeks'"""
        dates = []
        today = datetime.now()
        
        # Days of week
        days = {
            'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
            'friday': 4, 'saturday': 5, 'sunday': 6
        }
        
        # "next [day]" pattern
        pattern = r'\b(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b'
        
        for match in re.finditer(pattern, text, re.IGNORECASE):
            modifier, day_str = match.groups()
            try:
                target_day = days.get(day_str.lower(), 0)
                current_day = today.weekday()
                
                if modifier.lower() == 'next':
                    days_ahead = (target_day - current_day + 7) % 7
                    if days_ahead == 0:
                        days_ahead = 7
                else:  # this
                    days_ahead = (target_day - current_day) % 7
                
                target_date = today.replace(hour=0, minute=0, second=0, microsecond=0)
                from datetime import timedelta
                target_date += timedelta(days=days_ahead)
                
                context = self._get_context(text, match.start())
                
                dates.append({
                    'date': target_date.strftime('%m/%d/%Y'),
                    'format': 'Relative',
                    'context': context,
                    'type': self._classify_deadline(context),
                    'parsed_date': target_date
                })
            except:
                continue
        
        return dates
    
    def _get_context(self, text, position, window=50):
        """Get surrounding context for a date"""
        start = max(0, position - window)
        end = min(len(text), position + window)
        context = text[start:end].replace('\n', ' ').strip()
        
        # Clean up context
        context = re.sub(r'\s+', ' ', context)
        return context
    
    def _classify_deadline(self, context):
        """Classify the type of deadline based on context"""
        context_lower = context.lower()
        
        for keyword in self.deadline_keywords:
            if keyword in context_lower:
                return keyword
        
        return 'important date'