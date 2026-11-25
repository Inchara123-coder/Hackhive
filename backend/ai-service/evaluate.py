from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from training_data import TRAINING_ROWS


def evaluate(label_index: int, title: str) -> None:
    texts = [row[0] for row in TRAINING_ROWS]
    labels = [row[label_index] for row in TRAINING_ROWS]
    train_x, test_x, train_y, test_y = train_test_split(
        texts, labels, test_size=0.25, random_state=7, stratify=labels
    )
    model = Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
            ("classifier", LogisticRegression(max_iter=500, class_weight="balanced")),
        ]
    )
    model.fit(train_x, train_y)
    print(title)
    print(classification_report(test_y, model.predict(test_x), zero_division=0))


if __name__ == "__main__":
    evaluate(1, "Complaint category")
    evaluate(2, "Priority")
