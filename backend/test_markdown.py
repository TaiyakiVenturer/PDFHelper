import os

from services.pdf_service import MarkdownReconstructor

def test_markdown_reconstructor():
    instance_path = os.path.join(os.path.dirname(__file__), "instance")

    reconstructor = MarkdownReconstructor(instance_path, verbose=True)

    print("重組後的.md檔案路徑:", reconstructor.reconstruct("doc_f6a48d55", method="auto"))

if __name__ == "__main__":
    test_markdown_reconstructor()